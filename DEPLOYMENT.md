# GitHub Pages 部署準備

目前尚未建立遠端儲存庫或上傳，待使用者提供 GitHub 帳號與儲存庫後執行。

## 大型素材安排

- GitHub 一般 Git 檔案上限為 100 MiB，Pages 網站上限為 1 GB。既有 H.264 約 296 MB、HEVC 約 1.43 GB，不能直接將兩支加入 Pages。
- 原始兩版完整保留在本機 `dist`，並由 .gitignore 排除，避免誤推入 Git 歷史。
- 上線版使用原有 4K / 59.94fps H.264，沒有再次壓縮；相較 HEVC 的 120fps / 10-bit，影格數与色深不同，這是原專案既有的相容版。
- 後續將 `dist/survey_video.mp4` 以 Release asset 上傳至同一儲存庫的 `survey-media-v1`。每個 Release 檔案可低於 2 GiB。
- Actions 在建置時下載該影片，核對 media.json 的 SHA256，與頁面一起部署。因此使用者播放的是 Pages 同來源檔案，而非直接跨來源播放 Release 連結；Canvas 可正常擷取。
- 上線影片仍然較大，載入速度取決於使用者網路。preload=metadata 避免首頁就下載整段，Range 由 Pages 主機處理。公開後仍需實際檢查 Range、Canvas 及手機瀏覽器。

## 待執行步驟

1. 確認指定的 GitHub 儲存庫、公開範圍與素材可發布，再提交原始碼及 crops；不提交個人指引、記憶或 mp4。
2. 建立 `survey-media-v1` Release，資產名稱必須是 `survey_video.mp4`。
3. 儲存庫 Settings → Pages → Source 選 GitHub Actions。
4. Actions → Publish GitHub Pages → Run workflow。此 workflow 只有手動觸發，不會因 push 自動部署。
5. 等待建置與部署成功，使用產生的網址驗證首頁、影片、PNG 拍攝、比對及手機退出按鈕。

本機可先執行 `npm run build:pages` 產生 `.pages` 靜態部署內容；本命令不會上傳檔案。

## 官方依據

- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
- https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
