const $video = document.querySelector('video')
const $playbackSpeed = document.querySelector('.playback-speed')
const $playbackSpeedLabel = document.querySelector('.playback-speed-label')

const $midiOutputSelect = document.querySelector('.midi select.outputs')

const $currentTime = document.querySelector('.current-time')
const $currentFrame = document.querySelector('.current-frame')
const $poseData = document.querySelector('.pose-data')


let currentMidiOutput = null


setInterval(() => {
  $currentTime.innerText = $video.currentTime
  $currentFrame.innerText = Math.floor($video.currentTime * 29.97)
  
  const posesForCurrentTime = findClosestPoses($video.currentTime)
  $poseData.innerText = JSON.stringify(posesForCurrentTime)
}, 16)



$playbackSpeed.oninput = () => {
  $video.playbackRate = $playbackSpeedLabel.innerText = $playbackSpeed.value
}


window.onload = () => {
  
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



WebMidi.enable(err => {
  console.log(err)
  
  for (const output of WebMidi.outputs) {
    $midiOutputSelect.innerHTML = `
      <div class=""></div>
    `  
  }
  
})