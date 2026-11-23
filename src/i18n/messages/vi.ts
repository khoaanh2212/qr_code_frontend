import type { Messages } from "./en";

export const vi = {
  nav: {
    login: "Đăng nhập",
    signup: "Đăng ký",
    dashboard: "Bảng điều khiển",
    language: "Ngôn ngữ",
  },
  footer: {
    staticForever: "Mã QR tĩnh là của bạn và hoạt động mãi mãi.",
  },
  home: {
    title: "Tạo mã QR miễn phí",
    description: "Tạo mã QR miễn phí cho liên kết, Wi-Fi, danh thiếp và nhiều hơn nữa.",
    intro:
      "Tạo mã QR cho liên kết, văn bản, Wi-Fi, danh thiếp, email, SMS và số điện thoại. Không cần tài khoản.",
  },
  auth: {
    loginTitle: "Đăng nhập",
    registerTitle: "Tạo tài khoản",
    forgotPasswordTitle: "Quên mật khẩu",
    resetPasswordTitle: "Đặt mật khẩu mới",
    verifyEmailTitle: "Xác minh email",
  },
  session: {
    loading: "Đang tải…",
    loadFailed: "Không tải được tài khoản của bạn.",
    retry: "Thử lại",
  },
  dashboard: {
    welcome: "Xin chào, {name}",
  },
} satisfies Messages;
