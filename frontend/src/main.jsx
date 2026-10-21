import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './academy/AcademyApp.jsx'
import './index.css'

// 路由切换时 AcademyApp 自己把页面滚回顶部；浏览器的恢复会跟它抢。
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>
)
