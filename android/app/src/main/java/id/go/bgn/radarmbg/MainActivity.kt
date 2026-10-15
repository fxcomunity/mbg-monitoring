package id.go.bgn.radarmbg

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import id.go.bgn.radarmbg.ui.screens.HomeScreen
import id.go.bgn.radarmbg.ui.screens.LaporanScreen
import id.go.bgn.radarmbg.ui.screens.LoginScreen
import id.go.bgn.radarmbg.ui.screens.MenuScreen
import id.go.bgn.radarmbg.ui.screens.NotifikasiScreen
import id.go.bgn.radarmbg.ui.screens.PetaScreen
import id.go.bgn.radarmbg.ui.screens.ProfileScreen
import id.go.bgn.radarmbg.ui.screens.RegisterScreen
import id.go.bgn.radarmbg.ui.screens.SplashScreen
import id.go.bgn.radarmbg.ui.theme.RadarMBGTheme
import id.go.bgn.radarmbg.viewmodel.AuthViewModel
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import id.go.bgn.radarmbg.R
import id.go.bgn.radarmbg.ui.components.AppTopBar
import id.go.bgn.radarmbg.ui.components.RadarNavBar
import id.go.bgn.radarmbg.viewmodel.AuthUiState

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            RadarMBGTheme {
                val navController = rememberNavController()
                val authViewModel: AuthViewModel = viewModel()

                NavHost(
                    navController = navController,
                    startDestination = "splash"
                ) {
                    composable("splash") {
                        SplashScreen(
                            onNavigateToHome = {
                                navController.navigate("main") {
                                    popUpTo("splash") { inclusive = true }
                                }
                            },
                            onNavigateToLogin = {
                                navController.navigate("login") {
                                    popUpTo("splash") { inclusive = true }
                                }
                            },
                            authViewModel = authViewModel
                        )
                    }

                    composable("login") {
                        LoginScreen(
                            onLoginSuccess = {
                                navController.navigate("main") {
                                    popUpTo("login") { inclusive = true }
                                }
                            },
                            onNavigateToRegister = {
                                navController.navigate("register")
                            },
                            authViewModel = authViewModel
                        )
                    }

                    composable("register") {
                        RegisterScreen(
                            onRegisterSuccess = {
                                navController.navigate("login") {
                                    popUpTo("register") { inclusive = true }
                                }
                            },
                            onNavigateToLogin = {
                                navController.popBackStack()
                            },
                            authViewModel = authViewModel
                        )
                    }

                    composable("main") {
                        MainScaffold(
                            outerNavController = navController,
                            authViewModel = authViewModel
                        )
                    }

                    composable("notifikasi") {
                        NotifikasiScreen()
                    }

                    composable("profile") {
                        ProfileScreen(
                            onLogout = {
                                navController.navigate("login") {
                                    popUpTo(0) { inclusive = true }
                                }
                            },
                            authViewModel = authViewModel
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun MainScaffold(
    outerNavController: NavHostController,
    authViewModel: AuthViewModel
) {
    val innerNavController = rememberNavController()
    val navBackStackEntry by innerNavController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route ?: "home"

    val authUiState = authViewModel.uiState
    val userInitial = when (val s = authUiState.value) {
        is AuthUiState.Success -> s.user.full_name.firstOrNull()?.toString() ?: "U"
        else -> "U"
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = stringResource(R.string.app_name),
                badgeCount = 0,
                onNotificationClick = { outerNavController.navigate("notifikasi") },
                onProfileClick = { outerNavController.navigate("profile") },
                userInitial = userInitial
            )
        },
        bottomBar = {
            RadarNavBar(
                selectedRoute = currentRoute,
                onNavigate = { route ->
                    innerNavController.navigate(route) {
                        popUpTo(innerNavController.graph.startDestinationId) {
                            saveState = true
                        }
                        launchSingleTop = true
                        restoreState = true
                    }
                }
            )
        }
    ) { innerPadding ->
        NavHost(
            navController = innerNavController,
            startDestination = "home",
            modifier = Modifier.padding(innerPadding)
        ) {
            composable("home") {
                HomeScreen(
                    onNotificationClick = { outerNavController.navigate("notifikasi") },
                    onProfileClick = { outerNavController.navigate("profile") },
                    authViewModel = authViewModel
                )
            }
            composable("menu") {
                MenuScreen()
            }
            composable("peta") {
                PetaScreen()
            }
            composable("laporan") {
                LaporanScreen()
            }
        }
    }
}
