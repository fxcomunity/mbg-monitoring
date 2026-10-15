package id.go.bgn.radarmbg.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import id.go.bgn.radarmbg.R
import id.go.bgn.radarmbg.data.api.models.UserData
import id.go.bgn.radarmbg.ui.theme.BgnOnSurfaceVariant
import id.go.bgn.radarmbg.ui.theme.BgnPrimary
import id.go.bgn.radarmbg.ui.theme.BgnPrimaryContainer
import id.go.bgn.radarmbg.ui.theme.BgnTertiaryFixed
import id.go.bgn.radarmbg.viewmodel.AuthUiState
import id.go.bgn.radarmbg.viewmodel.AuthViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    onLogout: () -> Unit,
    authViewModel: AuthViewModel = viewModel()
) {
    val uiState by authViewModel.uiState.collectAsState()
    var showLogoutDialog by remember { mutableStateOf(false) }
    var showPasswordDialog by remember { mutableStateOf(false) }
    var oldPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }

    LaunchedEffect(uiState) {
        if (uiState is AuthUiState.LoggedOut) {
            onLogout()
        }
    }

    val user: UserData? = when (val s = uiState) {
        is AuthUiState.Success -> s.user
        else -> null
    }

    // Logout confirmation dialog
    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title = { Text(stringResource(R.string.confirm_logout)) },
            confirmButton = {
                Button(
                    onClick = {
                        showLogoutDialog = false
                        authViewModel.logout()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = BgnPrimary)
                ) {
                    Text(stringResource(R.string.btn_logout))
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) {
                    Text("Batal")
                }
            }
        )
    }

    // Change password dialog
    if (showPasswordDialog) {
        AlertDialog(
            onDismissRequest = { showPasswordDialog = false },
            title = { Text(stringResource(R.string.btn_ganti_password)) },
            text = {
                Column {
                    OutlinedTextField(
                        value = oldPassword,
                        onValueChange = { oldPassword = it },
                        label = { Text("Kata Sandi Lama") },
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = newPassword,
                        onValueChange = { newPassword = it },
                        label = { Text("Kata Sandi Baru") },
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Fitur dalam pengembangan",
                        fontSize = 12.sp,
                        color = BgnOnSurfaceVariant
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = { showPasswordDialog = false },
                    colors = ButtonDefaults.buttonColors(containerColor = BgnPrimary)
                ) {
                    Text("Tutup")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = stringResource(R.string.profile_judul),
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BgnPrimary)
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(24.dp))

            // Avatar circle with initial
            val initial = user?.full_name?.firstOrNull()?.uppercaseChar()?.toString() ?: "U"
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(CircleShape)
                    .background(BgnPrimaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = initial,
                    color = BgnTertiaryFixed,
                    fontWeight = FontWeight.Bold,
                    fontSize = 32.sp
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = user?.full_name ?: "—",
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
                color = BgnPrimary
            )
            Text(
                text = user?.role_label ?: "—",
                fontSize = 14.sp,
                color = BgnOnSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp)
            )
            if (user?.username?.isNotBlank() == true) {
                Text(
                    text = "@${user.username}",
                    fontSize = 13.sp,
                    color = BgnOnSurfaceVariant
                )
            }
            if (user?.sppg_name?.isNotBlank() == true) {
                Text(
                    text = user.sppg_name,
                    fontSize = 13.sp,
                    color = BgnOnSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(40.dp))

            OutlinedButton(
                onClick = { showPasswordDialog = true },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(
                    text = stringResource(R.string.btn_ganti_password),
                    color = BgnPrimary
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            OutlinedButton(
                onClick = { showLogoutDialog = true },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(
                    text = stringResource(R.string.btn_logout),
                    color = Color.Red
                )
            }
        }
    }
}
