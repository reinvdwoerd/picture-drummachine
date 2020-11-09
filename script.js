const $video = document.querySelector('video')
const $playbackSpeed = document.querySelector('.playback-speed')
const $playbackSpeedLabel = document.querySelector('.playback-speed-label')

const $currentTime = document.querySelector('.current-time')
const $currentFrame = document.querySelector('.current-frame')
const $poseData = document.querySelector('.pose-data')

setInterval(() => {
  $currentTime.innerText = $video.currentTime
  $currentFrame.innerText = Math.floor($video.currentTime * 29.97)
  
  const posesForCurrentTime = findClosestPoses($video.currentTime)
  $poseData.innerText = JSON.stringify(posesForCurrentTime)
}, 16)


$playbackSpeed.oninput = window.onload = () => {
  console.log($playbackSpeed.value)
  $video.playbackRate = $playbackSpeedLabel.innerText = $playbackSpeed.value
}



function findClosestPoses(currentTime) {
  let minDifference = Number.MAX_VALUE
  let closestPoses = null
  
  for (const {time, poses, scores} of poseValues) {
    const difference = Math.abs(time - currentTime)
    
    // It's closer!
    if (difference < minDifference) {
      minDifference = difference
      closestPoses = poses
    }
  }
  
  return closestPoses
}