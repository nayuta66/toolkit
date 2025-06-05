console.log('App started!');

// 模拟应用启动后的 API 调用
setTimeout(() => {
  console.log('App is now making regular API calls...');
  
  // 这些 API 可能已经被预请求缓存了
  fetch('/api/user/info')
    .then(res => res.json())
    .then(data => console.log('User info:', data))
    .catch(err => console.error('Error fetching user info:', err));
    
  fetch('/api/config')
    .then(res => res.json())
    .then(data => console.log('Config:', data))
    .catch(err => console.error('Error fetching config:', err));
}, 2000); 