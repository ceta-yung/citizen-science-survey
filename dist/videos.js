// 每次開始調查均獨立抽選；重播保留同一航次影片。
const SURVEY_VIDEOS = [
  "videos/265A7010.mp4",
  "videos/265A7914.mp4",
  "videos/266A0862.mp4"
];
function selectSurveyVideo(random = Math.random){
  return SURVEY_VIDEOS[Math.floor(random() * SURVEY_VIDEOS.length)];
}
