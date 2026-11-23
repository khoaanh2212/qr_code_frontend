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
  generator: {
    loading: "Đang tải…",
    typesLabel: "Loại mã QR",
    types: {
      url: "Website",
      text: "Văn bản",
      wifi: "Wi-Fi",
      vcard: "Danh thiếp",
      email: "Email",
      sms: "SMS",
      phone: "Điện thoại",
    },
    fields: {
      url: {
        url: { label: "Địa chỉ website", help: "Bắt đầu bằng https:// hoặc http://." },
      },
      text: {
        text: { label: "Văn bản", help: "" },
      },
      wifi: {
        ssid: { label: "Tên mạng (SSID)", help: "Tối đa 32 byte." },
        password: { label: "Mật khẩu", help: "WPA: 8 đến 63 ký tự. Với mạng mở, chọn Bảo mật là Không có." },
        encryption: { label: "Bảo mật", help: "" },
        hidden: { label: "Mạng ẩn", help: "" },
      },
      vcard: {
        first_name: { label: "Tên", help: "Nhập tên, họ hoặc tổ chức." },
        last_name: { label: "Họ", help: "" },
        organization: { label: "Tổ chức", help: "" },
        title: { label: "Chức danh", help: "" },
        phone: { label: "Điện thoại", help: "3 đến 15 chữ số, có thể bắt đầu bằng +." },
        email: { label: "Email", help: "" },
        website: { label: "Website", help: "Bắt đầu bằng https:// hoặc http://." },
        address: { label: "Địa chỉ", help: "" },
        note: { label: "Ghi chú", help: "" },
      },
      email: {
        to: { label: "Người nhận", help: "" },
        subject: { label: "Tiêu đề", help: "" },
        body: { label: "Nội dung", help: "" },
      },
      sms: {
        phone: { label: "Số điện thoại", help: "3 đến 15 chữ số, có thể bắt đầu bằng +." },
        message: { label: "Tin nhắn", help: "" },
      },
      phone: {
        phone: { label: "Số điện thoại", help: "3 đến 15 chữ số, có thể bắt đầu bằng +." },
      },
    },
    options: {
      WPA: "WPA/WPA2/WPA3",
      WEP: "WEP",
      nopass: "Không có (mạng mở)",
    },
    sections: {
      content: "Nội dung",
      design: "Thiết kế",
      download: "Tải về",
    },
    design: {
      fg: "Màu mã",
      bg: "Màu nền",
      ecc: "Mức sửa lỗi",
      eccLevels: {
        L: "Thấp (7%)",
        M: "Trung bình (15%)",
        Q: "Khá (25%)",
        H: "Cao (30%)",
      },
      margin: "Lề (ô)",
      lowContrast: "Dùng màu mã tối trên nền sáng, độ tương phản tối thiểu 3:1, nếu không máy quét có thể không đọc được.",
      logo: "Logo",
      logoHelp: "PNG hoặc JPEG, tối đa 1 MB và 1024 × 1024 px.",
      logoUpload: "Tải logo lên",
      colorPicker: "Chọn {name}",
      colorInvalid: "Nhập màu dạng #1A2B3C.",
      logoRemove: "Xoá logo",
      logoEcc: "Khi có logo, mã dùng mức sửa lỗi cao để vẫn quét được.",
      logoType: "Hãy chọn ảnh PNG hoặc JPEG.",
      logoSize: "Logo phải nhỏ hơn hoặc bằng 1 MB.",
    },
    preview: {
      title: "Xem trước",
      empty: "Nhập nội dung để xem mã QR của bạn.",
      updating: "Đang cập nhật…",
      alt: "Xem trước mã QR của bạn",
    },
    download: {
      format: "Định dạng",
      size: "Kích thước (px)",
      sizeHelp: "Từ {min} đến {max} px.",
      button: "Tải {format}",
      working: "Đang chuẩn bị…",
    },
    validation: {
      required: "Bắt buộc.",
      invalid: "Kiểm tra lại giá trị này.",
    },
    errors: {
      loadTypes: "Không tải được danh sách loại mã QR.",
      retry: "Thử lại",
      rateLimited: "Quá nhiều yêu cầu. Thử lại sau {seconds} giây.",
      busy: "Máy chủ đang bận. Vui lòng thử lại sau giây lát.",
      network: "Không kết nối được máy chủ. Kiểm tra kết nối mạng.",
      tooLarge: "Yêu cầu quá lớn. Hãy thử logo nhỏ hơn.",
      generic: "Đã có lỗi xảy ra. Vui lòng thử lại.",
    },
  },
  dashboard: {
    welcome: "Xin chào, {name}",
  },
} satisfies Messages;
