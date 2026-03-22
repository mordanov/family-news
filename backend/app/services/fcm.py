"""Firebase Cloud Messaging service for sending push notifications."""

import asyncio
import logging
from typing import Optional

import asyncpg
import firebase_admin
from firebase_admin import credentials, messaging

from app.config import FIREBASE_CREDENTIALS_PATH, FCM_ENABLED

logger = logging.getLogger(__name__)

_firebase_initialized = False


def initialize_firebase():
    """Initialize Firebase Admin SDK if credentials are available."""
    global _firebase_initialized
    if _firebase_initialized or not FCM_ENABLED:
        return

    try:
        cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred)
        _firebase_initialized = True
        logger.info("Firebase Admin SDK initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
        _firebase_initialized = False


async def register_fcm_token(
    pool: asyncpg.Pool,
    user_id: int,
    token: str,
    device_name: Optional[str] = None,
) -> dict:
    """
    Register or update an FCM token for a user.

    Args:
        pool: Database connection pool
        user_id: User ID
        token: FCM device token
        device_name: Optional device name/identifier

    Returns:
        Dictionary with token registration details
    """
    if not token or not token.strip():
        raise ValueError("Token cannot be empty")

    token = token.strip()

    async with pool.acquire() as conn:
        # Check if token already exists for this user
        existing = await conn.fetchrow(
            "SELECT id FROM fcm_tokens WHERE user_id = $1 AND token = $2",
            user_id,
            token,
        )

        if existing:
            # Update existing token
            await conn.execute(
                """
                UPDATE fcm_tokens
                SET device_name = $1, updated_at = NOW()
                WHERE user_id = $2 AND token = $3
                """,
                device_name,
                user_id,
                token,
            )
        else:
            # Insert new token
            await conn.execute(
                """
                INSERT INTO fcm_tokens (user_id, token, device_name)
                VALUES ($1, $2, $3)
                """,
                user_id,
                token,
                device_name,
            )

    return {
        "user_id": user_id,
        "token": token,
        "device_name": device_name,
        "status": "registered",
    }


async def unregister_fcm_token(pool: asyncpg.Pool, user_id: int, token: str) -> bool:
    """
    Unregister (delete) an FCM token.

    Args:
        pool: Database connection pool
        user_id: User ID
        token: FCM device token

    Returns:
        True if token was deleted, False otherwise
    """
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM fcm_tokens WHERE user_id = $1 AND token = $2",
            user_id,
            token,
        )
        # result is a string like "DELETE 1" if deleted, "DELETE 0" if not found
        return "1" in result


async def get_user_tokens(pool: asyncpg.Pool, user_id: int) -> list[str]:
    """
    Get all FCM tokens for a user.

    Args:
        pool: Database connection pool
        user_id: User ID

    Returns:
        List of FCM tokens
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT token FROM fcm_tokens WHERE user_id = $1",
            user_id,
        )
    return [row["token"] for row in rows]


async def get_all_tokens(pool: asyncpg.Pool) -> list[str]:
    """
    Get all FCM tokens from all users.

    Args:
        pool: Database connection pool

    Returns:
        List of all FCM tokens
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT token FROM fcm_tokens")
    return [row["token"] for row in rows]


async def delete_invalid_token(pool: asyncpg.Pool, token: str) -> bool:
    """
    Delete an FCM token that is no longer valid.

    Args:
        pool: Database connection pool
        token: FCM device token

    Returns:
        True if token was deleted, False otherwise
    """
    async with pool.acquire() as conn:
        result = await conn.execute("DELETE FROM fcm_tokens WHERE token = $1", token)
        return "1" in result


async def send_notification(
    pool: asyncpg.Pool,
    title: str,
    body: str,
    data: Optional[dict] = None,
    tokens: Optional[list[str]] = None,
) -> dict:
    """
    Send a notification to specified tokens or all tokens.

    Args:
        pool: Database connection pool
        title: Notification title
        body: Notification body
        data: Optional data payload
        tokens: Optional list of specific tokens. If None, sends to all tokens.

    Returns:
        Dictionary with send results (success_count, failed_count, errors)
    """
    if not FCM_ENABLED:
        logger.warning("FCM is not enabled, skipping notification send")
        return {
            "success_count": 0,
            "failed_count": 0,
            "errors": ["FCM not configured"],
        }

    if not _firebase_initialized:
        initialize_firebase()

    if not _firebase_initialized:
        return {
            "success_count": 0,
            "failed_count": 0,
            "errors": ["Firebase not initialized"],
        }

    try:
        # Get tokens to send to
        if tokens is None:
            tokens = await get_all_tokens(pool)

        if not tokens:
            logger.info("No tokens to send notifications to")
            return {
                "success_count": 0,
                "failed_count": 0,
                "errors": [],
            }

        # Prepare message
        message_data = data or {}
        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=title, body=body),
            data=message_data,
            tokens=tokens,
        )

        # Send message
        response = messaging.send_multicast(message)

        success_count = response.success_count
        failure_count = response.failure_count
        errors = []

        # Handle failed sends and delete invalid tokens
        if response.errors:
            for idx, error in enumerate(response.errors):
                if error is not None:
                    error_msg = str(error)
                    logger.warning(
                        f"Failed to send notification to token {idx}: {error_msg}"
                    )
                    errors.append(error_msg)

                    # Delete token if it's invalid
                    if idx < len(tokens):
                        token = tokens[idx]
                        if "invalid" in error_msg.lower() or "not-registered" in error_msg.lower():
                            await delete_invalid_token(pool, token)
                            logger.info(f"Deleted invalid token: {token}")

        logger.info(
            f"Notification sent: {success_count} success, {failure_count} failed"
        )

        return {
            "success_count": success_count,
            "failed_count": failure_count,
            "errors": errors,
        }

    except Exception as e:
        logger.error(f"Error sending notifications: {e}")
        return {
            "success_count": 0,
            "failed_count": len(tokens) if tokens else 0,
            "errors": [str(e)],
        }


async def send_news_notification(
    pool: asyncpg.Pool,
    news_id: int,
    description: str,
    author: str,
    created_at: Optional[str] = None,
) -> dict:
    """
    Send a notification about a newly published news item.

    Args:
        pool: Database connection pool
        news_id: News item ID
        description: News description (will be truncated)
        author: News author
        created_at: Creation timestamp

    Returns:
        Dictionary with send results
    """
    # Truncate description for notification
    max_len = 100
    truncated_desc = (description[:max_len] + "...") if len(description) > max_len else description

    title = f"Новая новость от {author}"
    body = truncated_desc

    data = {
        "news_id": str(news_id),
        "type": "news_published",
    }

    return await send_notification(pool, title, body, data)

