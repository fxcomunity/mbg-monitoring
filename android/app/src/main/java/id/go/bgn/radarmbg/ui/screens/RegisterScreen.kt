package id.go.bgn.radarmbg.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import id.go.bgn.radarmbg.R
import id.go.bgn.radarmbg.ui.theme.BgnPrimary
import id.go.bgn.radarmbg.ui.theme.StatusError
import id.go.bgn.radarmbg.viewmodel.AuthUiState
import id.go.bgn.radarmbg.viewmodel.AuthViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RegisterScreen(
    onRegisterSuccess: () -> Unit,
    onNavigateToLogin: () -> Unit,
    authViewModel: AuthViewModel = viewModel()
) {
    val uiState by authViewModel.uiState.collectAsState()
    var namaLengkap by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var konfirmasiPassword by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var konfirmasiVisible by remember { mutableStateOf(false) }
    var selectedRole by remember { mutableStateOf("user") }
    var sppgName by remember { mutableStateOf("") }
    var localError by remember { mutableStateOf("") }

    LaunchedEffect(uiState) {
        if (uiState is AuthUiState.Success) {
            onRegisterSuccess()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = stringResource(R.string.register_judul),
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BgnPrimary),
                navigationIcon = {
                    TextButton(onClick = onNavigateToLogin) {
                        Text(text = "←", color = Color.White, fontSize = 20.sp)
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(innerPadding)
                .padding(24.dp)
        ) {
            OutlinedTextField(
                value = namaLengkap,
                onValueChange = { namaLengkap = it },
                label = { Text(stringResource(R.string.hint_nama_lengkap)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text(stringResource(R.string.hint_email)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
            )
            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(
                value = username,
                onValueChange = { username = it },
                label = { Text(stringResource(R.string.hint_username)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text(stringResource(R.string.hint_password)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                trailingIcon = {
                    IconButton(onClick = { passwordVisible = !passwordVisible }) {
                        Text(text = if (passwordVisible) "👁" else "🔒", fontSize = 16.sp)
                    }
                }
            )
            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(
                value = konfirmasiPassword,
                onValueChange = { konfirmasiPassword = it },
                label = { Text(stringResource(R.string.hint_konfirmasi_password)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = if (konfirmasiVisible) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                trailingIcon = {
                    IconButton(onClick = { konfirmasiVisible = !konfirmasiVisible }) {
                        Text(text = if (konfirmasiVisible) "👁" else "🔒", fontSize = 16.sp)
                    }
                }
            )
            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = stringResource(R.string.label_role),
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                RadioButton(
                    selected = selectedRole == "user",
                    onClick = { selectedRole = "user" }
                )
                Text(
                    text = stringResource(R.string.role_user),
                    modifier = Modifier.padding(end = 16.dp)
                )
                RadioButton(
                    selected = selectedRole == "sppg",
                    onClick = { selectedRole = "sppg" }
                )
                Text(text = stringResource(R.string.role_sppg))
            }

            if (selectedRole == "sppg") {
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = sppgName,
                    onValueChange = { sppgName = it },
                    label = { Text(stringResource(R.string.hint_sppg_name)) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }

            if (localError.isNotBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = localError, color = StatusError, fontSize = 13.sp)
            }
            if (uiState is AuthUiState.Error) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = (uiState as AuthUiState.Error).message,
                    color = StatusError,
                    fontSize = 13.sp
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            Button(
                onClick = {
                    localError = ""
                    when {
                        password != konfirmasiPassword -> localError = "Kata sandi tidak cocok"
                        password.length < 6 -> localError = "Kata sandi minimal 6 karakter"
                        else -> authViewModel.register(namaLengkap, email, username, password, selectedRole, sppgName)
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = BgnPrimary),
                enabled = uiState !is AuthUiState.Loading
            ) {
                if (uiState is AuthUiState.Loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(stringResource(R.string.btn_register))
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            TextButton(
                onClick = onNavigateToLogin,
                modifier = Modifier.align(Alignment.CenterHorizontally)
            ) {
                Text(
                    text = stringResource(R.string.link_login),
                    color = BgnPrimary
                )
            }
        }
    }
}
