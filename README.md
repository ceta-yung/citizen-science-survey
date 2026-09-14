# 海上觀察室｜公民科學互動網頁

GitHub Pages 已上線：https://ceta-yung.github.io/citizen-science-survey/ 。原始碼與影片 Release 位於 ceta-yung/citizen-science-survey；部署流程見 DEPLOYMENT.md。

參考 `C:\Users\cetae\Desktop\Claude\互動網頁` 與 `project_interactive_survey_demo.md` 製作的本機新版。保留影片拍攝、照片篩選、目擊紀錄、個體目錄與成果報告。

## 啟動

電腦已安裝 Node.js。雙擊 `start_demo.bat`，或在本資料夾執行 `npm start`，再開啟 http://localhost:8766。無需 npm install。關閉伺服器終端或按 Ctrl+C 停止。

預設只開放這台電腦。若另行允許區域網路預覽，可在 PowerShell 執行 `$env:HOST='0.0.0.0'` 後 `npm start`；伺服器會列出手機網址。電腦與手機需在同一個可互通的 Wi-Fi，Windows 防火牆若提示，僅允許信任的私人網路。不要啟用路由器對外轉發。手機上的 localhost 指手機本身，不是電腦。

## 操作

- 電腦：移動游標瞄準，滾輪或 ＋ / − 變焦，按住影片或黃色快門連拍。可切換 1×、0.5×、0.25× 速度，也可暫停後拍攝。
- 手機：開啟時顯示橫向入口。點「進入橫向體驗」後嘗試全螢幕與原生方向鎖定。若不支援，使用頁面內旋轉的橫向畫面；右上角「✕ 關閉」可退出，回到直向響應式頁面。拒絕入口後仍可用右上角全螢幕按鈕再次進入。
- 拍攝：手機單指拖動瞄準，雙指或 ＋ / − 變焦；黃色快門拍攝，按住連拍。旋轉或放開手指會停止連拍。
- 篩選：點照片放大，按保留或刪除。待審循環會略過已決定的照片；可從卡片重新開啟並復原。桌面仍支援拖曳選用。
- 比對：左側選照片，右側選個體與目錄圖片；用滾輪、雙指或 ＋ / − 放大。拖曳平移，按重置回復。配對可解除；未配對照片可以保留未確認狀態。
- 成果：可列印或使用瀏覽器「儲存為 PDF」。所有紀錄僅留在目前頁面的記憶體；重新整理或關閉會清除。

## 手機瀏覽器限制

一般网页不能在未經點擊的開頁瞬間強制進入原生全螢幕。Fullscreen API 需要短暫使用者手勢，Screen Orientation lock 也受平台支援及全螢幕條件限制。iPhone / Safari、內嵌瀏覽器或 HTTP 區域網路連線可能不支援；替代布局能橫向操作，但不能隱藏瀏覽器本身的網址列。

本專案沒有假稱已繞過這些限制，也沒有 Service Worker 或離線影片快取。manifest 宣告 landscape，實際是否採用由瀏覽器決定。

- https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen
- https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock

## 素材與科學解讀

調查影片位於 `dist/videos`，由指定三部飛旋海豚素材製作 H.264 網頁版，保留來源解析度與完整片長。每次開始調查獨立隨機選片；重播沿用同片，重新開始會重新抽選。影片從 `survey-media-v2` Release 下載，SHA256 記錄於 media.json。

`crops` 共 6 個目錄、34 張照片，包含 NISL_0076。比對僅為教學練習，不能作為已確認個體辨識結果。

`server.js` 只提供 dist 資料夾；支援 HTTP Range，影片不必完整下載才能快轉。沒有對外資料上傳、帳號或後端紀錄保存。

## 驗證

執行 `npm test` 和 `npm run check`。測試涵蓋影片 Range 內容、目錄照片路徑、檔案邊界、旋轉座標、PNG 像素映射、連拍與待審循環。這些不是手機實機驗證；完整 iOS / Android 全螢幕及触控手感需以實機確認。

個體目錄資料已拆分至 dist/catalog.js。第三階段「下一個個體」使目前目錄向右滑出，新個體淡入；「上一個個體」向左滑出。動畫包含放大檢視，切換時暫停配對以避免誤操作。
