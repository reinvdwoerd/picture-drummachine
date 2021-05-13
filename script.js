let images = {}
let popup = {}
let canvas

let WIDTH = screen.width
let HEIGHT = screen.height
let NUMPADS = 127

Vue.use(VueSplitGrid);

async function setup() {
	canvas = createCanvas(WIDTH, HEIGHT);
	canvas.parent("main")
	let context = canvas.elt.getContext('2d');
	context.mozImageSmoothingEnabled = false;
	context.webkitImageSmoothingEnabled = false;
	context.msImageSmoothingEnabled = false;
	context.imageSmoothingEnabled = false;
	// canvas.elt.onclick = () => {
	// 	canvas.elt.fullscreen()
	// }

	background(0)
	noLoop()
}



const $ui = new Vue({
	el: '#picture-drummachine',
	components: {
	},
	data: {
		pads: [],

		inputs: null,
		currentMidiInput: null,

		dragSourceIndex: null,
		padsDropRange: null,

		size: 10,
		gridColumns: 7,

		draggingGutter: false,
		gutterPercent: 0.33
	},

	async mounted() {
		// Restore the amount of columns, or default
		this.gridColumns = localStorage.getItem('gridColumns') || 7
		this.gutterPercent = localStorage.getItem('gutterPercent') || .33


		// Try to initialize midi, show alert if it's not available
		// in this browser
		WebMidi.enable(err => {
			if (err) alert(err);
			this.inputs = WebMidi.inputs

			let restoredMidiInput = localStorage.getItem('midiInput')
			if (restoredMidiInput) {
				this.changeMidiInputAndAddAndRemoveListeners(WebMidi.getInputByName(restoredMidiInput))
			} else if (WebMidi.inputs.length > 0) {
				this.changeMidiInputAndAddAndRemoveListeners(WebMidi.inputs[0])
			}
		});

		// Try to restore all the images from indexedDB
		for (let i = 0; i < NUMPADS; i++) {
			let restored = await idbKeyval.get(`image-${i}`);
			this.pads.push({
				image: restored,
				justTriggered: false
			})

			if (restored) {
				images[i] = loadImage(restored)
			}
		}
	},

	computed: {
		gridColumnsStyle() {
			return {
				'grid-template-columns': `repeat(${this.gridColumns}, 1fr)`
			}
		},
		gridPadStyle() {
			return {
				'height': map(this.gridColumns, 2, 14, 200, 0)
			}
		},

		gridStyle() {
			const str = `${this.gutterPercent}fr 10px ${1 - this.gutterPercent}fr`
			console.log(str)
			return {
				'--area-1': `${this.gutterPercent}fr`,
				'--area-2': `${1 - this.gutterPercent}fr`
			}
		}
	},

	methods: {
		startDraggingGutter(e) {
			this.draggingGutter = true
		},

		stopDraggingGutter(e) {
			this.draggingGutter = false
		},

		moveGutter(e) {
			if (this.draggingGutter) {
				if (matchMedia("(min-aspect-ratio: 1/1)").matches) {
					const percent = e.clientX / innerWidth
					this.gutterPercent = percent
					localStorage.setItem('gutterPercent', percent)
				}
			}
		},

		goFullscreen() {
			canvas.elt.requestFullscreen()
		},

		setGridSize(event) {
			localStorage.setItem('gridColumns', event.target.value)
			this.gridColumns = Number(event.target.value)
		},

		onMidiInputChange(e) {
			currentMidiInput = WebMidi.getInputByName(e.target.value);
			console.log("changed output to: ", currentMidiInput.name);
			localStorage.setItem('midiInput', currentMidiInput.name)
		},

		changeMidiInputAndAddAndRemoveListeners(midiInput) {
			// If it exists, remove all listeners from previous
			if (this.currentMidiInput) {
				this.currentMidiInput.removeListener("noteon")
				this.currentMidiInput.removeListener("noteoff")
				this.currentMidiInput.removeListener("pitchbend")
			}

			this.currentMidiInput = midiInput

			this.currentMidiInput.addListener("noteon", "all", e => {
				let noteNumber = e.note.number
				this.triggerPad(noteNumber)
				this.pads[noteNumber].justTriggered = true
			})

			this.currentMidiInput.addListener("noteoff", "all", e => {
				let noteNumber = e.note.number
				this.pads[noteNumber].justTriggered = false
			})

			this.currentMidiInput.addListener("pitchbend", "all", e => {
				console.log(e.value)
				this.size = map(e.value, -1, 1, 5, WIDTH * 8)
			})
		},

		dragStartHandler(i) {
			this.dragSourceIndex = i
		},

		dragOverHandler(i, ev) {
			ev.preventDefault();
			this.padsDropRange = [i, i + ev.dataTransfer.files.length]
		},

		dropHandler(i, ev) {
			ev.preventDefault();

			// Only accept files or HTML text
			const items = Array.from(ev.dataTransfer.items)
				.filter(item => item.type == "text/html" || item.kind == "file")


			/**
			 * Drag and dropped from another pad.
			 * (prevent dropping on the same pad)
			 */
			if (this.dragSourceIndex !== null && i != this.dragSourceIndex) {
				let tempPadSource = this.pads[this.dragSourceIndex]
				let tempPadTarget = this.pads[i]

				// Assign source pad to target pad, target pad to source pad
				this.pads[i] = tempPadSource
				this.pads[this.dragSourceIndex] = tempPadTarget

				images[i] = loadImage(tempPadSource.image)
				idbKeyval.set(`image-${i}`, tempPadSource.image);

				images[this.dragSourceIndex] = loadImage(tempPadTarget.image)
				idbKeyval.set(`image-${this.dragSourceIndex}`, tempPadTarget.image);


				this.dragSourceIndex = null
			}


			/**
			 * It's a file or from a different website
			 */
			else {
				items.forEach(async (item, itemI) => {
					// HTML from a website
					if (item.type == "text/html") {
						item.getAsString(async string => {
							// console.log(string) // log the raw thing
							const url = extractImgUrlFromHtmlString(string)

							if (url.includes('data:image/')) {
								// It's already a data url (sometimes happens on Google Images)
								this.setPadImageDataUrlAndUpdate(i + itemI, url)
							} else {
								// It's a normal remote image
								const response = await fetch(url)
								const blob = await response.blob()
								const dataUrl = await readFileOrBlobAsDataUrl(blob)
								console.log(dataUrl)

								// Remote gif, split it into frames
								if (dataUrl.includes('data:image/gif')) {
									gifFrames({ url: dataUrl, frames: 'all', outputType: "canvas", cumulative: true }).then(frameData => {
										frameData.forEach(async (frame, frameI) => {
											const img = frame.getImage()
											console.log(frame, img)
											this.setPadImageDataUrlAndUpdate(i + itemI + frameI, img.toDataURL())
										})
									});
								} else {
									this.setPadImageDataUrlAndUpdate(i + itemI, dataUrl)
								}
							}
						})
					}

					// Local (?) file
					else if (item.kind == "file") {
						const file = item.getAsFile()
						console.log(item.type)

						// Read each frame separately
						if (item.type == "image/gif") {
							const dataUrl = await readFileOrBlobAsDataUrl(file)
							gifFrames({ url: dataUrl, frames: 'all', outputType: "canvas", cumulative: true }).then(frameData => {
								frameData.forEach(async (frame, frameI) => {
									const img = frame.getImage()
									console.log(frame, img)
									this.setPadImageDataUrlAndUpdate(i + itemI + frameI, img.toDataURL())
								})
							});
						}

						// Read only one frame, file formats that p5 accepts
						else if (["image/jpeg", "image/png"].includes(item.type)) {
							const dataUrl = await readFileOrBlobAsDataUrl(file)
							this.setPadImageDataUrlAndUpdate(i + itemI, dataUrl)
						}

						else {
							console.warn("file type not supported: ", item.type)
						}
					}
				});
			}

			this.pads.forEach(pad => {
				pad.justTriggered = false
			});

			this.$forceUpdate()
		},

		cancelDrop() {
			this.dragSourceIndex = null
		},

		setPadImageDataUrlAndUpdate(i, dataUrl) {
			this.pads[i].image = dataUrl
			images[i] = loadImage(dataUrl)
			idbKeyval.set(`image-${i}`, dataUrl);
			// console.log(dataUrl)
			this.$forceUpdate()
		},


		padPressed(i) {
			if (!this.dragSourceIndex) {
				this.triggerPad(i)
				this.pads[i].justTriggered = true
			}
		},

		padReleased(i) {
			this.pads[i].justTriggered = false
		},

		triggerPad(i) {
			if (images[i]) {
				// 'Drawing' with the mouse
				if (mouseIsPressed) {
					imageMode(CENTER)
					image(images[i], mouseX, mouseY, this.size, images[i].height * this.size / images[i].width)
				}
				// Normal, stretched, full-screen
				else {
					imageMode(CORNER)
					image(images[i], 0, 0, WIDTH, HEIGHT)
				}
			}
		},

		// Needs to be a Vue method because it's used in the template
		getNoteNameAndOctave(midiNoteNum) {
			let octave = Math.floor((midiNoteNum / 12)) - 2;
			let note = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][midiNoteNum % 12]
			return `${note}${octave}`
		},

		willBeDroppedIn(i) {
			if (this.padsDropRange == null) return false
			return i > this.padsDropRange[0] && i < this.padsDropRange[1]
		}
	}
})






// UTILITIES =======================================
// =================================================
function clamp(num, min, max) {
	return num <= min ? min : num >= max ? max : num;
}


async function readFileOrBlobAsDataUrl(something) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = async () => {
			resolve(reader.result)
		}
		reader.readAsDataURL(something);
	})
}

function extractImgUrlFromHtmlString(string) {
	const dummyEl = document.createElement('div')
	dummyEl.innerHTML = string
	const img = dummyEl.querySelector('img')
	// console.log(img)
	const url = img.getAttribute('src')
	return url
}