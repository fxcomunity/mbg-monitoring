package id.go.bgn.radarmbg.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import id.go.bgn.radarmbg.data.api.models.UserData
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "radar_mbg_session")

object SessionDataStore {

    private val IS_LOGGED_IN = booleanPreferencesKey("is_logged_in")
    private val USERNAME = stringPreferencesKey("username")
    private val FULL_NAME = stringPreferencesKey("full_name")
    private val ROLE = stringPreferencesKey("role")
    private val SPPG_NAME = stringPreferencesKey("sppg_name")

    suspend fun saveSession(context: Context, user: UserData) {
        context.dataStore.edit { prefs ->
            prefs[IS_LOGGED_IN] = true
            prefs[USERNAME] = user.username
            prefs[FULL_NAME] = user.full_name
            prefs[ROLE] = user.role
            prefs[SPPG_NAME] = user.sppg_name
        }
    }

    suspend fun clearSession(context: Context) {
        context.dataStore.edit { prefs ->
            prefs.clear()
        }
    }

    fun isLoggedIn(context: Context): Flow<Boolean> {
        return context.dataStore.data.map { prefs ->
            prefs[IS_LOGGED_IN] ?: false
        }
    }

    fun getUser(context: Context): Flow<UserData?> {
        return context.dataStore.data.map { prefs ->
            val loggedIn = prefs[IS_LOGGED_IN] ?: false
            if (loggedIn) {
                UserData(
                    username = prefs[USERNAME] ?: "",
                    full_name = prefs[FULL_NAME] ?: "",
                    role = prefs[ROLE] ?: "",
                    sppg_name = prefs[SPPG_NAME] ?: ""
                )
            } else {
                null
            }
        }
    }
}
