import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import PrivateRoute from './auth/PrivateRoute'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import MiPlanPage from './pages/MiPlanPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/register" element={<RegisterPage/>}/>
          <Route path="/login" element={<LoginPage/>}/>
          <Route path="/mi-plan" element={<PrivateRoute><MiPlanPage/></PrivateRoute>}/>
          <Route path="/" element={<PrivateRoute><Navigate to="/mi-plan" replace/></PrivateRoute>}/>
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
