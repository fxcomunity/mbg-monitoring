package id.go.bgn.radarmbg.ui.components

import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import id.go.bgn.radarmbg.R
import id.go.bgn.radarmbg.ui.theme.BgnPrimary
import androidx.compose.material3.Icon

@Composable
fun RadarNavBar(
    selectedRoute: String,
    onNavigate: (String) -> Unit
) {
    val items = listOf(
        NavItem("home", R.drawable.ic_beranda, R.string.nav_beranda),
        NavItem("menu", R.drawable.ic_menu_hari_ini, R.string.nav_menu),
        NavItem("peta", R.drawable.ic_distribusi, R.string.nav_peta),
        NavItem("laporan", R.drawable.ic_laporan, R.string.nav_laporan)
    )

    NavigationBar(
        containerColor = Color.White
    ) {
        items.forEach { item ->
            val selected = selectedRoute == item.route
            NavigationBarItem(
                selected = selected,
                onClick = { onNavigate(item.route) },
                icon = {
                    Icon(
                        painter = painterResource(id = item.iconRes),
                        contentDescription = stringResource(item.labelRes),
                        tint = if (selected) BgnPrimary else Color.Gray
                    )
                },
                label = {
                    Text(
                        text = stringResource(item.labelRes),
                        color = if (selected) BgnPrimary else Color.Gray
                    )
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = BgnPrimary,
                    selectedTextColor = BgnPrimary,
                    indicatorColor = BgnPrimary.copy(alpha = 0.1f),
                    unselectedIconColor = Color.Gray,
                    unselectedTextColor = Color.Gray
                )
            )
        }
    }
}

private data class NavItem(
    val route: String,
    val iconRes: Int,
    val labelRes: Int
)
