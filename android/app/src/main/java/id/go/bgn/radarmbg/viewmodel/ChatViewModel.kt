package id.go.bgn.radarmbg.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.go.bgn.radarmbg.data.repository.DataRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import com.google.gson.Gson
import java.util.UUID

data class ChatMessage(
    val text: String,
    val fromUser: Boolean
)

data class ChatUiState(
    val satgasMessages: List<ChatMessage> = listOf(
        ChatMessage(
            text = "Halo, saya asisten Satgas BGN. Silakan tanyakan informasi seputar program MBG.",
            fromUser = false
        )
    ),
    val sppgMessages: List<ChatMessage> = listOf(
        ChatMessage(
            text = "Halo, silakan tanyakan informasi operasional dapur, menu, atau distribusi SPPG.",
            fromUser = false
        )
    ),
    val isSending: Boolean = false,
    val error: String? = null,
    val satgasSessionId: String = UUID.randomUUID().toString(),
    val sppgSessionId: String = UUID.randomUUID().toString()
)

class ChatViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState = _uiState.asStateFlow()

    fun sendMessage(text: String, targetType: String, targetSppgName: String) {
        val message = text.trim()
        if (message.isEmpty() || _uiState.value.isSending) return
        if (targetType == "sppg" && targetSppgName.isBlank()) {
            _uiState.value = _uiState.value.copy(error = "Masukkan nama SPPG terlebih dahulu.")
            return
        }

        val previousState = _uiState.value
        val previousMessages = if (targetType == "sppg") {
            previousState.sppgMessages
        } else {
            previousState.satgasMessages
        }
        val history = Gson().toJson(
            previousMessages.drop(1).takeLast(10).map { item ->
                mapOf(
                    "role" to if (item.fromUser) "user" else "assistant",
                    "content" to item.text
                )
            }
        )
        _uiState.value = if (targetType == "sppg") {
            previousState.copy(
                sppgMessages = previousState.sppgMessages + ChatMessage(message, fromUser = true),
                isSending = true,
                error = null
            )
        } else {
            previousState.copy(
                satgasMessages = previousState.satgasMessages + ChatMessage(message, fromUser = true),
                isSending = true,
                error = null
            )
        }

        viewModelScope.launch {
            DataRepository.sendChat(
                message = message,
                sessionId = if (targetType == "sppg") previousState.sppgSessionId else previousState.satgasSessionId,
                targetType = targetType,
                targetSppgName = targetSppgName.trim(),
                history = history
            ).onSuccess { response ->
                if (response.status == "success" && response.reply.isNotBlank()) {
                    val latestState = _uiState.value
                    _uiState.value = if (targetType == "sppg") {
                        latestState.copy(
                            sppgMessages = latestState.sppgMessages + ChatMessage(response.reply, fromUser = false),
                            sppgSessionId = response.session_id.ifBlank { latestState.sppgSessionId }
                        )
                    } else {
                        latestState.copy(
                            satgasMessages = latestState.satgasMessages + ChatMessage(response.reply, fromUser = false),
                            satgasSessionId = response.session_id.ifBlank { latestState.satgasSessionId }
                        )
                    }.copy(isSending = false)
                } else {
                    _uiState.value = _uiState.value.copy(
                        isSending = false,
                        error = response.message.ifBlank { "Balasan chat tidak tersedia. Coba lagi." }
                    )
                }
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(
                    isSending = false,
                    error = error.message ?: "Pesan gagal dikirim. Periksa koneksi lalu coba lagi."
                )
            }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}
