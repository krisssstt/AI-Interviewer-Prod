(() => {
  'use strict';
  let csrf = '';
  class ApiError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }
  const request = async (path, options = {}) => {
    let response;
    try {
      response = await fetch('/api' + path, {
        method: options.method || 'GET', credentials: 'same-origin',
        headers: {'Content-Type': 'application/json', 'X-CSRF-Token': csrf},
        ...(options.body !== undefined ? {body: JSON.stringify(options.body)} : {})
      });
    } catch { throw new ApiError('Нет соединения с сервером. Данные сохранены в форме; повторите действие.', 0); }
    const result = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(typeof result?.detail === 'string' ? result.detail : 'Ошибка сервера. Повторите действие.', response.status);
    if (result?.csrf_token) csrf = result.csrf_token;
    return result;
  };
  window.Api = {request, ApiError};
})();
