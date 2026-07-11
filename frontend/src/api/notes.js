import { apiRequest, getApiBaseUrl, getStoredToken, ApiError } from './client'

export function listNotes(entityType, entityId) {
  return apiRequest('/notes', { params: { entityType, entityId } })
}

export function createNote(note) {
  return apiRequest('/notes', { method: 'POST', body: note })
}

export function getNote(id) {
  return apiRequest(`/notes/${id}`)
}

export function updateNote(id, updates) {
  return apiRequest(`/notes/${id}`, { method: 'PATCH', body: updates })
}

export function deleteNote(id) {
  return apiRequest(`/notes/${id}`, { method: 'DELETE' })
}

function buildUrl(path) {
  const baseUrl = getApiBaseUrl()
  const absoluteUrl = baseUrl.startsWith('http') ? baseUrl : `${window.location.origin}${baseUrl}`
  return `${absoluteUrl}${path}`
}

async function parseErrorResponse(response) {
  try {
    const payload = await response.json()
    return payload?.message || payload?.error || 'Momentum could not complete that request.'
  } catch {
    return 'Momentum could not complete that request.'
  }
}

// Bypasses apiRequest (which always JSON.stringifies the body) since a file
// upload needs multipart/form-data — the browser sets the boundary itself as
// long as we don't set Content-Type manually.
export async function uploadAttachment(noteId, file, { onProgress } = {}) {
  const token = getStoredToken()
  const formData = new FormData()
  formData.append('file', file)

  // Use XHR instead of fetch so upload progress is observable — fetch has no
  // upload-progress event, which would leave large-file uploads feeling stuck.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', buildUrl(`/notes/${noteId}/attachments`))
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }

    xhr.onload = () => {
      let payload = null
      try { payload = JSON.parse(xhr.responseText) } catch { /* non-JSON response */ }

      if (xhr.status >= 200 && xhr.status < 300 && payload?.success) {
        resolve(payload.data)
      } else {
        reject(new ApiError(payload?.message || 'Could not upload the attachment.', { status: xhr.status, details: payload }))
      }
    }

    xhr.onerror = () => reject(new ApiError("Momentum couldn't reach the server. Check your connection and try again.", { status: 0 }))

    xhr.send(formData)
  })
}

export function deleteAttachment(noteId, attachmentId) {
  return apiRequest(`/notes/${noteId}/attachments/${attachmentId}`, { method: 'DELETE' })
}

// Downloads require the Authorization header, so a plain <a href> won't work
// — fetch the file as a blob, then trigger a normal browser download from it.
export async function downloadAttachment(noteId, attachmentId, filename) {
  const token = getStoredToken()
  const response = await fetch(buildUrl(`/notes/${noteId}/attachments/${attachmentId}`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!response.ok) {
    throw new ApiError(await parseErrorResponse(response), { status: response.status })
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename || 'attachment'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
