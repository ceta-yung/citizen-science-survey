# GitHub Pages 部署

目標：ceta-yung/citizen-science-survey；網站 https://ceta-yung.github.io/citizen-science-survey/

1. 將 media.json 所列三部 MP4 上傳至 survey-media-v3 Release。
2. 執行 npm test、npm run check、npm run build:pages。建置校驗所有影片 SHA256，網站總容量須小於 1 GB。
3. 推送 main，將儲存庫設為 Public，Pages 選擇 GitHub Actions。
4. 手動執行 Publish GitHub Pages workflow。影片會下載至 dist/videos，並與網站一起部署，維持同來源播放及 Canvas 拍攝。

原始素材保留於本機來源資料夾；不提交大型 MP4 到 Git。mobile-test 為另行產生的單片离線測試包，不隨網站發布。
