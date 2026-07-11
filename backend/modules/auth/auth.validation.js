const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  // At least 8 chars, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

const validateUsername = (username) => {
  // 3-20 chars, alphanumeric + underscore
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
};

const validateRegisterInput = ({ email, password, confirmPassword, username }) => {
  const errors = {};

  if (!email || !validateEmail(email)) {
    errors.email = 'Valid email is required';
  }

  if (!username || !validateUsername(username)) {
    errors.username = 'Username must be 3-20 characters (alphanumeric + underscore)';
  }

  if (!password || !validatePassword(password)) {
    errors.password = 'Password must be at least 8 characters with uppercase, lowercase, and number';
  }

  if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
};

const validateLoginInput = ({ email, password }) => {
  const errors = {};

  if (!email || !validateEmail(email)) {
    errors.email = 'Valid email is required';
  }

  if (!password) {
    errors.password = 'Password is required';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
};

module.exports = {
  validateEmail,
  validatePassword,
  validateUsername,
  validateRegisterInput,
  validateLoginInput,
};
