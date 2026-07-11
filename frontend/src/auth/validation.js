export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(email) {
  if (!email) return 'Email is required'
  if (!emailRegex.test(email)) return 'Please enter a valid email address'
  return null
}

export function validateUsername(username) {
  if (!username) return 'Username is required'
  if (username.length < 3) return 'Username must be at least 3 characters'
  if (username.length > 20) return 'Username must be at most 20 characters'
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Username can only contain letters, numbers, and underscores'
  return null
}

export function validatePassword(password) {
  if (!password) return 'Password is required'
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter'
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter'
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number'
  return null
}

export function validateConfirmPassword(password, confirmPassword) {
  if (!confirmPassword) return 'Please confirm your password'
  if (password !== confirmPassword) return 'Passwords do not match'
  return null
}

export function validateRegistration(email, username, password, confirmPassword) {
  const emailError = validateEmail(email)
  if (emailError) return { field: 'email', message: emailError }

  const usernameError = validateUsername(username)
  if (usernameError) return { field: 'username', message: usernameError }

  const passwordError = validatePassword(password)
  if (passwordError) return { field: 'password', message: passwordError }

  const confirmError = validateConfirmPassword(password, confirmPassword)
  if (confirmError) return { field: 'confirmPassword', message: confirmError }

  return null
}

export function validateLogin(email, password) {
  const emailError = validateEmail(email)
  if (emailError) return { field: 'email', message: emailError }

  if (!password) return { field: 'password', message: 'Password is required' }

  return null
}
