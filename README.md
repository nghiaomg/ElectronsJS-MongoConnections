# AskMongo v2.1

AskMongo (trước đây là ElectronsJS-MongoConnections) là một ứng dụng desktop được xây dựng bằng Electron và JavaScript, cho phép người dùng kết nối và quản lý cơ sở dữ liệu MongoDB một cách trực quan với trợ lý AI tích hợp.

![Demo](https://ik.imagekit.io/0lpnflx37/images/MongoConnection/Screenshot%202025-05-11%20224547.png)

## Tính năng mới trong v2.1

- **GEMINI AI Assistant**: Trợ lý AI giúp tạo truy vấn MongoDB dễ dàng bằng ngôn ngữ tự nhiên
- Hiển thị thông báo lỗi đẹp hơn với hướng dẫn chi tiết
- Textarea truy vấn cải tiến: có thể mở rộng và hỗ trợ nhiều dòng
- Thêm phím tắt Ctrl+Enter để chạy truy vấn
- AI Assistant nhận biết context cơ sở dữ liệu hiện tại để đưa ra gợi ý chính xác

## Tính năng từ v2.0

- Toast notifications cho các thao tác thành công
- Giao diện người dùng với hiệu ứng mượt mà
- Hỗ trợ lưu lịch sử kết nối (tối đa 5 kết nối gần nhất)
- Tự động kết nối lại với database/collection đã chọn sau khi reload

## Tính năng cơ bản

- Kết nối đến MongoDB server thông qua connection string
- Hiển thị danh sách databases và collections
- Tạo, đổi tên và xóa databases và collections
- Xem và chỉnh sửa documents trong collections
- Hỗ trợ hai chế độ xem: Table View và JSON View
- Giao diện người dùng thân thiện với menu ngữ cảnh
- Hỗ trợ format JSON tự động khi chỉnh sửa

## Cài đặt

1. Clone repository này:
   ```bash
   git clone https://github.com/nghiaomg/AskMongo.git
   ```

2. Di chuyển vào thư mục dự án:
   ```bash
   cd AskMongo
   ```

3. Cài đặt các dependencies:
   ```bash
   npm install
   ```

4. Chạy ứng dụng:
   ```bash
   npm start
   ```

## Sử dụng

1. Khởi động ứng dụng
2. Nhập MongoDB connection string hoặc chọn từ lịch sử kết nối
3. Nhấn "Connect" để kết nối đến MongoDB server
4. Duyệt qua các databases và collections
5. Sử dụng menu ngữ cảnh (chuột phải) để thực hiện các thao tác với databases và collections
6. Xem và chỉnh sửa documents trong chế độ Table View hoặc JSON View
7. Sử dụng GEMINI AI Assistant để tạo truy vấn MongoDB bằng ngôn ngữ tự nhiên

## Sử dụng GEMINI AI Assistant

1. Chọn database và collection để cung cấp context cho AI
2. Nhấn nút robot bên cạnh ô nhập truy vấn
3. Nhập mô tả truy vấn bạn muốn thực hiện bằng ngôn ngữ tự nhiên (ví dụ: "Tìm tất cả user đăng ký trong tháng này")
4. Nhấn "Ask GEMINI" để AI tạo truy vấn MongoDB
5. Nhấn "Use This Query" để sử dụng truy vấn được tạo

## Các phím tắt

- `Ctrl + Enter`: Chạy truy vấn MongoDB 
- `Ctrl + R` hoặc `F5`: Reload dữ liệu
- `Ctrl + N`: Tạo document mới
- `Ctrl + S`: Lưu chỉnh sửa document
- `Esc`: Đóng modal

## Đóng góp

Mọi đóng góp đều được hoan nghênh. Vui lòng mở một issue để thảo luận về những thay đổi lớn trước khi thực hiện.

## Changelog

### v2.1
- Tích hợp GEMINI AI Assistant cho việc tạo truy vấn bằng ngôn ngữ tự nhiên
- Cải thiện hiển thị lỗi với thông báo chi tiết hơn
- Nâng cấp textarea truy vấn với khả năng mở rộng và hỗ trợ nhiều dòng
- Thêm phím tắt Ctrl+Enter để chạy truy vấn
- AI nhận biết context cơ sở dữ liệu hiện tại
- Đổi tên dự án thành AskMongo

### v2.0
- Thêm toast notifications
- Cải thiện UI/UX
- Thêm tính năng lưu lịch sử kết nối
- Thêm tính năng tự động kết nối lại
- Sửa các lỗi từ v1.0

### v1.0
- Phiên bản đầu tiên với các tính năng cơ bản

## License

MIT License

By nghiaomg