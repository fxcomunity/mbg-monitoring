package id.go.bgn.radarmbg.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.go.bgn.radarmbg.ui.theme.BgnPrimary
import id.go.bgn.radarmbg.ui.theme.BgnTertiaryFixed

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppTopBar(
    title: String,
    badgeCount: Int = 0,
    onNotificationClick: () -> Unit,
    onProfileClick: () -> Unit,
    userInitial: String = "U"
) {
    TopAppBar(
        title = {
            Text(
                text = title,
                color = Color.White,
                fontWeight = FontWeight.SemiBold,
                fontSize = 18.sp
            )
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = BgnPrimary
        ),
        actions = {
            // Notification icon with badge
            IconButton(onClick = onNotificationClick) {
                BadgedBox(
                    badge = {
                        if (badgeCount > 0) {
                            Badge { Text(text = badgeCount.toString()) }
                        }
                    }
                ) {
                    Icon(
                        imageVector = Icons.Default.Notifications,
                        contentDescription = "Notifikasi",
                        tint = Color.White
                    )
                }
            }
            // Profile avatar with initial
            IconButton(onClick = onProfileClick) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(BgnTertiaryFixed),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = userInitial.uppercase().take(1),
                        color = BgnPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                }
            }
        }
    )
}
