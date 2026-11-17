package id.go.bgn.radarmbg.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Report
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import id.go.bgn.radarmbg.R
import id.go.bgn.radarmbg.data.api.models.UserData
import id.go.bgn.radarmbg.ui.theme.BgnOnSurface
import id.go.bgn.radarmbg.ui.theme.BgnOnSurfaceVariant
import id.go.bgn.radarmbg.ui.theme.BgnPrimary
import id.go.bgn.radarmbg.ui.theme.BgnPrimaryContainer
import id.go.bgn.radarmbg.ui.theme.BgnBackground
import id.go.bgn.radarmbg.ui.theme.BgnTertiaryFixed
import id.go.bgn.radarmbg.viewmodel.AuthUiState
import id.go.bgn.radarmbg.viewmodel.AuthViewModel
import id.go.bgn.radarmbg.viewmodel.PasswordChangeState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    onLogout: () -> Unit,
    onNavigateToDashboard: () -> Unit,
    onNavigateToAdminPanel: () -> Unit,
    onNavigateToLaporan: () -> Unit,
    authViewModel: AuthViewModel = viewModel()
) {
    val uiState by authViewModel.uiState.collectAsState()
    val passwordChangeState by authViewModel.passwordChangeState.collectAsState()
    var showLogoutDialog by remember { mutableStateOf(false) }
    var showPasswordDialog by remember { mutableStateOf(false) }
    var oldPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }

    LaunchedEffect(uiState) {
        if (uiState is AuthUiState.LoggedOut) {
            onLogout()
        }
    }

    LaunchedEffect(passwordChangeState) {
        if (passwordChangeState is PasswordChangeState.Success) {
            oldPassword = ""
            newPassword = ""
            confirmPassword = ""
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
                    Text(stringResource(R.string.btn_batal))
                }
            }
        )
    }

    // Change password dialog
    if (showPasswordDialog) {
        AlertDialog(
            onDismissRequest = {
                showPasswordDialog = false
                authViewModel.resetPasswordChangeState()
            },
            title = { Text(stringResource(R.string.btn_ganti_password)) },
            text = {
                Column {
                    OutlinedTextField(
                        value = oldPassword,
                        onValueChange = { oldPassword = it },
                        label = { Text(stringResource(R.string.hint_password_lama)) },
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = newPassword,
                        onValueChange = { newPassword = it },
                        label = { Text(stringResource(R.string.hint_password_baru)) },
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = confirmPassword,
                        onValueChange = { confirmPassword = it },
                        label = { Text(stringResource(R.string.hint_konfirmasi_password)) },
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    when (val state = passwordChangeState) {
                        is PasswordChangeState.Error -> Text(
                            text = state.message,
                            fontSize = 12.sp,
                            color = Color(0xFFB91C1C)
                        )
                        is PasswordChangeState.Success -> Text(
                            text = state.message,
                            fontSize = 12.sp,
                            color = Color(0xFF047857)
                        )
                        else -> Unit
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (passwordChangeState is PasswordChangeState.Success) {
                            showPasswordDialog = false
                            authViewModel.resetPasswordChangeState()
                        } else {
                            authViewModel.changePassword(oldPassword, newPassword, confirmPassword)
                        }
                    },
                    enabled = passwordChangeState !is PasswordChangeState.Loading,
                    colors = ButtonDefaults.buttonColors(containerColor = BgnPrimary)
                ) {
                    if (passwordChangeState is PasswordChangeState.Loading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            color = Color.White,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text(
                            if (passwordChangeState is PasswordChangeState.Success) {
                                stringResource(R.string.btn_tutup)
                            } else {
                                "Simpan Kata Sandi"
                            }
                        )
                    }
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
                .background(BgnBackground)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 16.dp),
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

            Spacer(modifier = Modifier.height(24.dp))

            // Navigation section
            Text(
                text = stringResource(R.string.dashboard_judul),
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                color = BgnOnSurfaceVariant,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp)
            )

            NavCard(
                titleRes = R.string.card_buka_dashboard,
                icon = Icons.Default.Dashboard,
                subtitleRes = R.string.dashboard_judul,
                onClick = onNavigateToDashboard
            )

            Spacer(modifier = Modifier.height(8.dp))

            if (user?.role == "admin") {
                NavCard(
                    titleRes = R.string.card_panel_admin,
                    icon = Icons.Default.AdminPanelSettings,
                    subtitleRes = R.string.admin_panel_judul,
                    onClick = onNavigateToAdminPanel
                )
                Spacer(modifier = Modifier.height(8.dp))
            }

            NavCard(
                titleRes = R.string.card_laporan_aduan,
                icon = Icons.Default.Report,
                subtitleRes = R.string.laporan_judul,
                onClick = onNavigateToLaporan
            )

            Spacer(modifier = Modifier.height(40.dp))

            OutlinedButton(
                onClick = {
                    oldPassword = ""
                    newPassword = ""
                    confirmPassword = ""
                    authViewModel.resetPasswordChangeState()
                    showPasswordDialog = true
                },
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

@Composable
private fun NavCard(
    titleRes: Int,
    icon: ImageVector,
    subtitleRes: Int,
    onClick: () -> Unit
) {
    ElevatedCard(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.elevatedCardColors()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = BgnPrimary,
                modifier = Modifier.size(24.dp)
            )
            Column(
                modifier = Modifier
                    .padding(start = 12.dp)
                    .weight(1f)
            ) {
                Text(
                    text = stringResource(titleRes),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = BgnOnSurface
                )
                Text(
                    text = stringResource(subtitleRes),
                    fontSize = 12.sp,
                    color = BgnOnSurfaceVariant
                )
            }
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = BgnOnSurfaceVariant
            )
        }
    }
}
