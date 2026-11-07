# Bảo mật ứng dụng — sáu nhóm kiểm soát

| STT | Nhóm | Ưu tiên | Biện pháp đã triển khai |
| --- | --- | --- | --- |
| 1 | Improper Credential Usage | Rất cao | SecureStore, khóa JWT bắt buộc, mật khẩu bcrypt, chống lộ bí mật |
| 2 | Inadequate Supply Chain Security | Cao | Ghim phiên bản, lockfile, chặn install scripts, audit/CI và Dependabot |
| 3 | Insecure Authentication/Authorization | Rất cao | Kiểm tra tài khoản mỗi request, thu hồi phiên, quyền sở hữu tài nguyên |
| 4 | Insufficient Input/Output Validation | Rất cao | Schema allowlist, giới hạn dữ liệu, giá/tồn kho từ server, tái mã hóa ảnh |
| 5 | Insecure Communication | Rất cao | HTTPS production, proxy rõ ràng, native chặn cleartext, TLS DB từ xa |
| 6 | Inadequate Privacy Controls | Cao | Giảm lưu PII, đồng ý AI, xuất dữ liệu, đóng/ẩn danh tài khoản, ảnh riêng tư |

Các biện pháp là thay đổi trong mã và cấu hình; không phải chứng nhận đã loại bỏ mọi lỗ hổng. TLS production cần tên miền/chứng chỉ và cấu hình máy chủ thật. Hướng dẫn: [HTTPS deployment](deployment/HTTPS.md).

- Token native dùng Expo SecureStore; token web chỉ nằm trong bộ nhớ. Token AsyncStorage cũ bị xóa, người dùng đăng nhập lại. Xem [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).
- JWT bắt buộc khóa riêng ít nhất 32 byte, chỉ HS256, kiểm tra issuer/audience, hạn 1 ngày. Khóa không hợp lệ khiến server từ chối khởi động. Tạo bằng `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` và lưu ở backend/.env hoặc secret manager. Không đưa khóa vào EXPO_PUBLIC_*.
- Mật khẩu đăng ký/đặt lại: tối thiểu 12 ký tự, tối đa 72 byte vì bcrypt. Tài khoản cũ vẫn đăng nhập được.
- OTP sinh bằng crypto.randomInt, hết hạn 10 phút; database chỉ lưu HMAC có khóa, thời hạn và bộ đếm thử. Challenge bị khóa sau 5 lần sai; cập nhật mật khẩu và tiêu thụ OTP trong cùng transaction.
- Giới hạn chung 20 yêu cầu xác thực/IP/15 phút, gồm login/register/OTP/reset. Hiện lưu trong bộ nhớ; nhiều server cần giới hạn chung ở gateway hoặc Redis. Chỉ cấu hình trust proxy với proxy thực sự tin cậy.
- Bản phát hành app bắt buộc URL API HTTPS qua EXPO_PUBLIC_API_BASE_URL. Cấu hình TLS ở reverse proxy của backend. Email bắt buộc TLS và chặn truy cập file/URL trong nội dung thư.
- `.env` được bỏ qua Git. Khóa Gemini đã lộ cần thu hồi tại nhà cung cấp và thay bằng khóa mới. Thay JWT_SECRET sẽ làm mất hiệu lực mọi token trước đó.

## Thư viện

Cả hai package.json ghim phiên bản trực tiếp, package-lock.json ghim phụ thuộc bắc cầu và integrity. Dùng `npm ci` ở thư mục gốc và backend; `.npmrc` chặn install scripts mặc định. Nếu một SDK cần bước build, xem xét riêng script trước khi chạy thủ công. Xem [npm ci](https://docs.npmjs.com/cli/commands/npm-ci/).

GitHub Actions kiểm tra npm audit (chặn high/critical), chữ ký registry và test backend; action được ghim commit. Dependabot tạo đề xuất cập nhật hằng tuần, không tự merge. Các kiểm tra này chỉ chạy khi đưa mã lên GitHub có Actions.

Chạy `node scripts/check-secrets.js` để kiểm tra các mẫu khóa phổ biến trong file Git theo dõi. Đây là kiểm tra mẫu, không bảo đảm phát hiện mọi bí mật hoặc lịch sử Git.

Node khuyến nghị: 24 theo .nvmrc. Máy hiện tại dùng Node 20, thấp hơn yêu cầu của Expo và Gemini SDK. Chưa xác minh giao diện trên Android/iOS và gửi email SMTP thực.

JWT bị thu hồi khi mật khẩu đổi thông qua fingerprint HMAC của bcrypt hash. Repo hiện theo dõi node_modules dù .gitignore đã loại trừ; nên bỏ theo dõi thư mục này trong một thay đổi dọn repo riêng và dựng lại bằng npm ci. Không chạy npm audit fix --force để tự hạ phiên bản Expo.

## Kết quả ngày 07/11/2026

Backend: 0 high/critical, 1 moderate (qs). App: 0 high/critical, 5 moderate (glob/minimatch và các gói Expo liên quan). Đây là kết quả npm audit tại thời điểm kiểm tra, không phải chứng nhận an toàn toàn diện. Nodemailer nâng từ 8 lên 10.3.1; đã kiểm tra dựng email OTP không gửi, cần kiểm tra SMTP thật khi triển khai. Bộ kiểm thử backend hiện đạt 163/163.


## Nhóm 3 và 4 — xác thực/phân quyền, kiểm tra dữ liệu (07/11/2026)

API riêng tư kiểm tra JWT rồi truy vấn trạng thái tài khoản ở mỗi request. UserId lấy từ tài khoản đã xác thực; request không được gán userId, role, IsActive hay thuộc tính thanh toán. Token chứa fingerprint HMAC gắn với bcrypt hash; khóa/xóa tài khoản hoặc đổi mật khẩu khiến token cũ bị từ chối ngay ở lần gọi tiếp theo. Token từ bản trước chưa có fingerprint cần đăng nhập lại. DB lỗi trả 503 và không cho request đi tiếp. App chưa có vai trò quản trị trong schema/API; bảo vệ hiện tại dựa trên quyền sở hữu tài nguyên, không tự cấp quyền admin.

Login, đăng ký, OTP, khôi phục mật khẩu, hồ sơ, giỏ hàng, đặt hàng, voucher, phân trang và callback thanh toán đều có kiểm tra kiểu dữ liệu, giới hạn độ dài/giá trị và danh sách trường cho phép. Số lượng là số nguyên 1–99, tối đa 50 món và không cho lặp mã sản phẩm. Giá từ client chỉ là dữ liệu hiển thị, không được dùng tính tiền. Số tiền cọc bàn cố định ở server là 100.000 VND, theo chính sách hiện có ở StoreScreen. Body JSON giới hạn 64KB. Login có thông báo lỗi chung và bcrypt so sánh giả cho email chưa tồn tại; giới hạn thử xác thực áp dụng cả theo IP và email.

Đặt hàng khóa hàng tồn và kiểm tra sản phẩm đang bán trong transaction; hủy COD khóa đơn theo cả OrderId/UserId, chỉ hoàn kho một lần. Mỗi API trả chi tiết đơn kiểm tra chủ sở hữu trước khi lấy các dòng món; các trường đầu ra được liệt kê rõ thay vì SELECT *. Đơn VNPay không cho khách tự hủy qua API hủy COD vì phiên gateway đang chờ vẫn có thể thu tiền; liên hệ hỗ trợ để đối soát/hoàn tiền.

### Cài đặt database và thanh toán

Đã áp dụng migration tạo bảng PaymentTransactions trên MySQL cục bộ, không thay đổi đơn cũ. Khi triển khai môi trường khác, chạy `npm run migrate:security` trong backend **trước** khi khởi động code mới. Schema tạo mới database cũng bao gồm bảng này. Migration chạy lại được; bảng gắn khóa ngoại Orders và tách trạng thái pending/paid/failed khỏi trạng thái giao hàng. Không tự suy đoán trạng thái thanh toán của các đơn VNPay cũ; cần đối soát riêng.

Chỉ IPN VNPay có chữ ký đúng, đúng merchant, đúng đơn VNPay và đúng số tiền mới cập nhật trạng thái. IPN được xử lý trong transaction với khóa hàng; callback lặp không thay đổi lại trạng thái hay hoàn kho lại. Browser return chỉ hiển thị, không sửa đơn kể cả khi có chữ ký đúng. App gọi API chi tiết đơn có xác thực để lấy paymentStatus, không tin vnp_ResponseCode trong URL. Nếu IPN chưa đến, app hiện đang chờ và cho kiểm tra lại.

Cấu hình VNPay IPN tới `/api/vnpay/ipn` trên endpoint công khai HTTPS trong tài khoản sandbox/merchant. VNP_RETURN_URL phải là địa chỉ backend mà thiết bị truy cập được. Để chạy production cần PUBLIC_BASE_URL HTTPS và CORS_ORIGINS liệt kê các web origin được phép; reverse proxy phải cấp HTTPS. Không tin Host/X-Forwarded-* tùy ý để tạo URL. IPN chưa được kiểm thử qua gateway thật; đơn pending cần quy trình đối soát/hết hạn ở môi trường vận hành, không tự giải phóng hàng trước khi xác nhận gateway.

### Ảnh và đầu ra

Ảnh đại diện tối đa 5MB, một file/request, không nhận trường multipart dư. Sharp giải mã JPEG/PNG/WebP, giới hạn 16 triệu pixel, đổi thành WebP tối đa 512×512, loại metadata và tự sinh tên file. SVG, HTML giả ảnh, ảnh hỏng hoặc vượt giới hạn bị từ chối. Không dùng tên file/phần mở rộng do client gửi. File cũ được giữ để tránh upload đồng thời xóa nhầm ảnh hiện tại; có thể dọn bằng tác vụ retention riêng.

URL ảnh chỉ chấp nhận đường dẫn assets nội bộ. HTML callback escape dữ liệu; response có nosniff, CSP, no-store cho API và không phản chiếu stack trace/JSON lỗi. CORS dùng allowlist cho web, vẫn cho native app không có Origin. Tham khảo [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) và [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html).

Bộ kiểm thử hiện đạt 77/77. Kiểm thử tự động bao phủ tài khoản khóa/xóa/đổi mật khẩu, giả user/role, truy cập chéo đơn hàng, sai kiểu/giới hạn dữ liệu, thiếu đăng nhập, callback sai chữ ký/số tiền, replay, lỗi JSON và ảnh giả. Kiểm tra MySQL dùng bảng tạm riêng rồi rollback, xác nhận cú pháp SQL và bảo toàn tồn kho. Chưa kiểm thử trên thiết bị thật hoặc hoàn tất giao dịch VNPay thật.


## Nhóm 5 — truyền dữ liệu

Server production kiểm tra PUBLIC_BASE_URL và VNP_RETURN_URL là HTTPS đúng origin, kiểm tra host VNPay chính thức và danh sách CORS. Listener mặc định chỉ bind 127.0.0.1 khi production. TRUST_PROXY chỉ nhận proxy/IP/subnet cụ thể; không tin header chuyển tiếp từ peer ngoài danh sách. Request production không được Express xác định là HTTPS trả 426 trước khi đọc JSON hay xác thực. Đã kiểm tra request giả X-Forwarded-Proto từ peer không tin cậy bị chặn. HSTS bổ sung chính sách trình duyệt, không thay thế chứng chỉ hoặc mã hóa kết nối.

App kiểm tra URL thực, chặn userinfo/query/fragment/path trên origin API và URL đổi origin. Bản native mặc định chặn HTTP với Android usesCleartextTraffic=false và iOS ATS; chỉ build đánh dấu APP_VARIANT=development mới cho phép HTTP phát triển. Expo Go dùng manifest riêng, cần dựng lại binary để áp dụng cấu hình native. WebView VNPay kiểm tra gateway chính thức HTTPS, callback thuộc API đã cấu hình; chặn scheme bên ngoài, file access, mixed content và nhiều cửa sổ. Mọi scheme đi qua guard thay vì cho thư viện tự mở liên kết bằng OS.

MySQL remote production bắt buộc DB_TLS=true với tên DNS khớp chứng chỉ, rejectUnauthorized/verifyIdentity bật và TLS tối thiểu 1.2; có thể cung cấp DB_SSL_CA. Các script DB cũng dùng cấu hình TLS đó. SMTP yêu cầu TLS; Gemini dùng HTTPS qua SDK. Không cấu hình certificate pinning tùy tiện vì cần chiến lược xoay chứng chỉ; CA/hostname verification vẫn bắt buộc.

Chưa cài chứng chỉ công khai hay thay firewall của máy này. Xem [nginx mẫu](deployment/nginx-https.conf.example). Không bật NODE_ENV=production trước khi cấu hình đầy đủ endpoint HTTPS, proxy và CORS.

## Nhóm 6 — quyền riêng tư

Hồ sơ (email, điện thoại, địa chỉ) không còn lưu ở AsyncStorage. Khi khởi động, app xóa các key cũ, dùng native token lấy lại hồ sơ qua API có xác thực; lỗi xác thực mạng sẽ đóng phiên cục bộ. Giỏ hàng chỉ giữ trường sản phẩm cần thiết dưới key theo tài khoản. Login/logout xóa cache cũ, chờ thao tác lưu đang chạy, xóa lựa chọn AI và thông báo cho màn hình đang mở xóa dữ liệu. Các tùy chọn giao diện, ngôn ngữ và thông báo chỉ có boolean được giữ. Navigation tách theo phiên, không thể quay lại màn hình riêng tư cũ sau logout.

Chat cần đồng ý rõ ràng trước lần dùng đầu; backend từ chối aiConsent khác true trước khi chạy dịch vụ. Phiên bản thông báo được lưu trên thiết bị và xóa khi đổi/đăng xuất tài khoản. Tắt AI hủy request ở app, xóa lịch sử trong bộ nhớ và chặn request mới; không thể thu hồi nội dung đã truyền tới Google. Dịch vụ miễn phí của Gemini có thể dùng nội dung để cải thiện sản phẩm và có quy định riêng về dữ liệu cá nhân; thông báo trong app không còn hứa rằng nội dung không chia sẻ cho bên thứ ba. Xem [Gemini API Terms](https://ai.google.dev/gemini-api/terms). Bộ lọc không nhận diện được mọi dữ liệu cá nhân, nên app nhắc không nhập dữ liệu nhạy cảm. Không bật billing hoặc thay model.

Ảnh đại diện không còn được công khai qua /avatars. GET /api/user/avatar yêu cầu JWT và chỉ đọc ảnh của người gọi, bỏ qua userId/filename từ query, chặn path traversal/symlink. PrivateAvatar lấy ảnh bằng Bearer trong header, không đưa token vào URL; ảnh hiển thị bằng data URI trong bộ nhớ và bị xóa khi đổi phiên. no-store áp dụng cho ảnh và dữ liệu cá nhân. Profile upload chỉ dùng URL server sau khi lưu thành công.

GET /api/privacy/export xuất hồ sơ, địa chỉ, đơn/chi tiết, thanh toán, giỏ, thông báo và hóa đơn của chính tài khoản, không có password hash/OTP/token. Giới hạn 10.000 dòng mỗi nhóm, 5MB toàn bộ; vượt giới hạn trả lỗi rõ thay vì âm thầm cắt. Bản web tải JSON; native mở hộp thoại chia sẻ do người dùng chọn. Bản xuất có dữ liệu cá nhân, không tự gửi email hay tải lên dịch vụ khác.

POST /api/privacy/delete-account chỉ nhận password hiện tại, tối đa 5 lần thử/tài khoản/15 phút. Trong transaction, dịch vụ khóa tài khoản, xác nhận mật khẩu, chặn đơn đang xử lý/thanh toán chưa đối soát; sau đó vô hiệu hóa tài khoản, đổi credential fingerprint, ẩn danh hồ sơ và snapshot người nhận trong đơn, xóa cart/địa chỉ/thông báo. Dữ liệu kế toán gồm mã, số tiền, chi tiết món và tham chiếu gateway vẫn giữ; không xóa toàn bộ lịch sử giao dịch. Ảnh cũ được xóa sau commit theo filename cố định của chủ sở hữu; nếu filesystem lỗi, trả avatarCleanupPending và ghi mã cần xử lý lại. Tài khoản đóng không thể lấy ảnh qua API.

Checkout và mọi thay đổi giỏ đều khóa Users trước để không tạo dữ liệu mới sau khi đóng tài khoản. Profile/avatar UPDATE chỉ thành công khi IsActive=1. Không thực hiện đóng tài khoản thật trong quá trình phát triển; các test dùng DB giả hoặc bảng MySQL tạm riêng.

Kết quả kiểm thử backend hiện tại: 177/177 đạt; bộ test logic frontend: 16/16 đạt. Các file JS/JSX parse được. npm audit: backend 1 moderate, app 5 moderate, cả hai 0 high/critical. Chưa chạy giao diện trên thiết bị thật, giao dịch VNPay thật, TLS với domain thật hoặc SMTP thật. Node trên máy hiện là 20; dự án yêu cầu Node 24 để build Expo/SDK đầy đủ.

Upload mới trong backend/public/avatars được bỏ qua bởi Git. File ảnh đã có trong lịch sử Git hoặc bản sao lưu không tự biến mất khi đóng tài khoản; cần quy trình xóa/retention riêng cho những bản sao đó trước khi chia sẻ repo hoặc môi trường lưu trữ.

## Mã hóa dữ liệu lưu trữ

Email, tên, điện thoại và địa chỉ hồ sơ; thông tin người nhận/ghi chú đơn hàng; địa chỉ giao hàng và nội dung thông báo dùng AES-256-GCM, gắn ciphertext với bảng, bản ghi và cột. Email/số điện thoại chỉ có blind index HMAC để tra cứu. OTP chỉ lưu HMAC có khóa, thời hạn và bộ đếm thử. Ảnh đại diện được mã hóa trước khi ghi file trong thư mục quyền 0700, file quyền 0600. Ứng dụng từ chối khởi động nếu chưa xác minh trạng thái migration và khóa.

Với dữ liệu hiện có, trước tiên tạo và giữ keyring riêng bền vững; mọi instance dùng chung cùng keyring đã được phân phối an toàn, không tự tạo khóa độc lập. Trong thư mục `backend`, chạy `npm run crypto:init` nếu chưa có keyring, sau đó `npm run migrate:storage -- --dry-run`. Dừng ứng dụng trước khi chạy `npm run migrate:storage -- --apply --confirm-app-stopped`; trước khi thay đổi schema/dữ liệu, lệnh tạo before-image đã mã hóa tại `backend/.private/backups`. Giữ backup và mọi khóa mã hóa/index/OTP nếu còn cần đọc database hoặc khôi phục. Với ảnh cũ, chạy `npm run migrate:avatars -- --dry-run`, rồi `npm run migrate:avatars -- --apply` khi ứng dụng đã dừng; before-image ảnh cũng được mã hóa. Dry-run không sửa dữ liệu. Chưa chạy các lệnh `--apply` trên môi trường triển khai; cần lưu/kiểm chứng backup và keyring theo quy trình vận hành trước khi áp dụng.

## Khóa đăng nhập và mật khẩu

Login dùng transaction InnoDB cùng `SELECT ... FOR UPDATE`, đếm thất bại trên server theo tài khoản và khóa tạm 30 giây ở lần sai thứ tư. Sai tiếp sau khi khóa hết hạn kéo dài khóa thêm 30 giây mỗi chu kỳ; đăng nhập thành công xóa bộ đếm và thời lượng khóa. Chuỗi sai được làm mới sau 30 giây không có lần sai mới. `IsActive=0` là vô hiệu hóa quản trị riêng biệt và không tự mở lại. API trả thông báo chung cho email không tồn tại, mật khẩu sai, tài khoản đang khóa hoặc vô hiệu hóa; countdown trên app chỉ là gợi ý cục bộ và không thay thế quyết định của server.

Trước khi khởi động backend trên schema cũ, chạy `cd backend && npm run migrate:login-security`; migration bổ sung các cột đếm sai/khóa theo cách chạy lại an toàn. Cả schema mới và migration đều có các cột này; backend từ chối khởi động nếu migration chưa được áp dụng.

Mật khẩu mới cần ít nhất 12 ký tự và tối đa 72 byte cho bcrypt, bị từ chối nếu khớp trọn vẹn blocklist nội bộ hoặc có trong Pwned Passwords của Have I Been Pwned. Backend dùng k-anonymity range API: chỉ gửi 5 ký tự đầu của SHA-1, không gửi mật khẩu hay toàn bộ hash; kết quả prefix được cache có giới hạn. Nếu dịch vụ kiểm tra không khả dụng, đăng ký/đổi/đặt lại mật khẩu mới bị tạm từ chối thay vì bỏ qua kiểm tra. Tham khảo [Pwned Passwords API](https://haveibeenpwned.com/API/v3#PwnedPasswords).

Đổi mật khẩu đã xác thực qua `POST /api/auth/change-password` (body `currentPassword`, `newPassword`) và đặt lại qua OTP đều áp dụng cùng kiểm tra. Sau khi đổi mật khẩu, fingerprint bcrypt làm token cũ mất hiệu lực; app yêu cầu đăng nhập lại. Khôi phục OTP đặt lại cả bộ đếm/khóa tạm, nhưng không mở tài khoản quản trị đã vô hiệu hóa.
