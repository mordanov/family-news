package ru.familynews.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.familynews.app.data.remote.UserDto

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UsersScreen(
    usersVm: UsersViewModel,
    auth: AuthViewModel,
    onBack: () -> Unit,
) {
    LaunchedEffect(Unit) { usersVm.load() }

    var deleteTarget by remember { mutableStateOf<UserDto?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Пользователи") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
        ) {
            Text("Новый пользователь", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.padding(4.dp))
            OutlinedTextField(
                value = usersVm.newLogin,
                onValueChange = { usersVm.newLogin = it },
                label = { Text("Логин") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            Spacer(Modifier.padding(4.dp))
            OutlinedTextField(
                value = usersVm.newPassword,
                onValueChange = { usersVm.newPassword = it },
                label = { Text("Пароль") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            Spacer(Modifier.padding(4.dp))
            var expanded by remember { mutableStateOf(false) }
            ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = !expanded }) {
                OutlinedTextField(
                    value = if (usersVm.newRole == "full_access") "Полный доступ" else "Только чтение",
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Роль") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(),
                )
                ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    DropdownMenuItem(
                        text = { Text("Только чтение") },
                        onClick = {
                            usersVm.newRole = "read_only"
                            expanded = false
                        },
                    )
                    DropdownMenuItem(
                        text = { Text("Полный доступ") },
                        onClick = {
                            usersVm.newRole = "full_access"
                            expanded = false
                        },
                    )
                }
            }
            Spacer(Modifier.padding(8.dp))
            Button(
                onClick = { usersVm.createUser() },
                enabled = !usersVm.loading,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Создать") }
            usersVm.error?.let {
                Spacer(Modifier.padding(4.dp))
                Text(it, color = MaterialTheme.colorScheme.error)
            }
            Spacer(Modifier.padding(12.dp))
            Text("Список", style = MaterialTheme.typography.titleMedium)
            if (usersVm.loading && usersVm.users.isEmpty()) {
                CircularProgressIndicator(Modifier.align(Alignment.CenterHorizontally))
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(usersVm.users, key = { it.id }) { u ->
                        UserRow(
                            user = u,
                            currentId = auth.me?.userId,
                            onDelete = { deleteTarget = u },
                            onRoleChange = { role -> usersVm.setRole(u.id, role) },
                        )
                    }
                }
            }
        }
    }

    deleteTarget?.let { u ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Удалить пользователя?") },
            text = { Text(u.login) },
            confirmButton = {
                TextButton(
                    onClick = {
                        usersVm.deleteUser(u.id)
                        deleteTarget = null
                    },
                ) { Text("Удалить") }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) { Text("Отмена") }
            },
        )
    }
}

@Composable
private fun UserRow(
    user: UserDto,
    currentId: Long?,
    onDelete: () -> Unit,
    onRoleChange: (String) -> Unit,
) {
    Card(Modifier.fillMaxWidth()) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(user.login, style = MaterialTheme.typography.titleSmall)
                Text(
                    if (user.role == "full_access") "Полный доступ" else "Только чтение",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            if (user.id != currentId) {
                var menuOpen by remember { mutableStateOf(false) }
                Box {
                    IconButton(onClick = { menuOpen = true }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "Меню")
                    }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(
                            text = { Text("Роль: только чтение") },
                            onClick = {
                                onRoleChange("read_only")
                                menuOpen = false
                            },
                        )
                        DropdownMenuItem(
                            text = { Text("Роль: полный доступ") },
                            onClick = {
                                onRoleChange("full_access")
                                menuOpen = false
                            },
                        )
                        DropdownMenuItem(
                            text = { Text("Удалить") },
                            onClick = {
                                onDelete()
                                menuOpen = false
                            },
                        )
                    }
                }
            }
        }
    }
}
