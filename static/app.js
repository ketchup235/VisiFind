class VoiceSearchApp {
  constructor() {
    // initialize instance variables
    this.searchResults = []
    this.filteredResults = []
    this.currentQuery = ""
    this.recognition = null
    this.voiceSupported = false
    // initialize UI elements and voice recognition
    this.initializeElements()
    this.initializeVoiceRecognition()
    this.setupEventListeners()
    this.initializeInterface()
  }

  initializeElements() {
    this.feedbackText = document.getElementById("feedback-text")
    this.searchResultsContainer = document.getElementById("search-results")
    this.filteredResultsContainer = document.getElementById("filtered-results")
    this.mainContentArea = document.getElementById("main-content-area")
    this.voiceIndicator = document.getElementById("voice-indicator")
    this.inputFallback = document.getElementById("input-fallback")
    this.textSearchInput = document.getElementById("text-search-input")
    this.searchButton = document.getElementById("search-button")
  }

  initializeVoiceRecognition() {
    // assign voice recognition based on which one browser supports
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

      try {
        // configure recognition settings and event handlers
        this.recognition = new SpeechRecognition()
        this.recognition.continuous = false
        this.recognition.interimResults = false
        this.recognition.lang = "en-US"
        // when recognition starts, start listening
        this.recognition.onstart = () => {
          this.isListening = true
          this.voiceIndicator.classList.add("listening")
          this.updateFeedback("Listening")
        }

        this.recognition.onresult = (event) => {
          // get transcript of recognized speech
          const transcript = event.results[0][0].transcript
          console.log("Voice input received:", transcript)
          this.processCommand(transcript)
        }
        // when recognition ends, stop listening
        this.recognition.onend = () => {
          this.isListening = false
          this.voiceIndicator.classList.remove("listening")
        }
        // deal with different error types
        this.recognition.onerror = (event) => {
          console.log("Speech recognition error:", event.error)
          this.isListening = false
          this.voiceIndicator.classList.remove("listening")

          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            this.showVoiceFallback("Microphone access denied. Using text input instead.")
          } else if (event.error === "no-speech") {
            setTimeout(() => {
              if (this.voiceSupported && !this.isListening) {
                this.startListening()
              }
            }, 1000)
          } else {
            this.showVoiceFallback("Voice recognition unavailable. Using text input instead.")
          }
        }

        this.voiceSupported = true
        console.log("Voice recognition initialized successfully")
      } catch (error) {
        console.log("Voice recognition initialization failed:", error)
        this.showVoiceFallback("Voice recognition not supported. Using text input.")
      }
    } else {
      console.log("Speech recognition not supported in this browser")
      this.showVoiceFallback("Voice recognition not supported in this browser. Using text input.")
    }
  }

  // initialize user interface
  initializeInterface() {
    if (this.voiceSupported) {
      this.voiceIndicator.style.display = "flex"
      this.inputFallback.style.display = "none"
      this.updateFeedback("Ready to search. Speak your query")
      this.startListening()
    } else {
      this.showVoiceFallback("Using text-based search interface.")
    }

    this.searchResultsContainer.innerHTML =
      '<p class="loading-text">Say "search for [your query]" or enter text above to get started...</p>'
  }

  // fallback to text input if voice recognition fails
  showVoiceFallback(message) {
    this.voiceSupported = false
    this.voiceIndicator.style.display = "none"
    this.inputFallback.style.display = "block"
    this.updateFeedback(message)
    this.textSearchInput.focus()
  }

  // start voice recognition
  startListening() {
    if (!this.voiceSupported || this.isListening || !this.recognition) return

    try {
      this.recognition.start()
    } catch (error) {
      console.log("Failed to start recognition:", error)
      this.showVoiceFallback("Voice recognition error. Using text input.")
    }
  }

  // stop voice recognition
  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop()
    }
  }

  // process text input from fallback
  processTextInput() {
    const query = this.textSearchInput.value.trim()
    if (!query) {
      this.updateFeedback("Please enter a search query.")
      return
    }

    this.processCommand(query)
    this.textSearchInput.value = ""
  }

  // process voice or text command
  processCommand(command) {
    const lowerCommand = command.toLowerCase()
    console.log("Processing command:", lowerCommand)

    this.announceHeardCommand(command, () => {
      // look for certain keywords to determine next steps
      if (lowerCommand.includes("search for") || lowerCommand.includes("find")) {
        const query = this.extractSearchQuery(lowerCommand)
        this.performSearch(query)
      } else if (lowerCommand.includes("select result") || lowerCommand.includes("open result")) {
        const resultNumber = this.extractNumber(lowerCommand)
        this.selectResult(resultNumber)
      } else if (lowerCommand.includes("add result") || lowerCommand.includes("save result")) {
        const resultNumber = this.extractNumber(lowerCommand)
        this.addToFiltered(resultNumber)
      } else if (lowerCommand.includes("clear results") || lowerCommand.includes("reset")) {
        this.clearResults()
      } else {
        this.performSearch(command)
      }
    })
  }

  // extract search query from command
  extractSearchQuery(command) {
    const patterns = [/search for (.+)/i, /find (.+)/i, /look for (.+)/i]

    for (const pattern of patterns) {
      const match = command.match(pattern)
      if (match) {
        return match[1]
      }
    }

    return command
  }

  // extract number from command
  extractNumber(command) {
    const numberWords = {
      one: 1,
      first: 1,
      two: 2,
      second: 2,
      three: 3,
      third: 3,
      four: 4,
      fourth: 4,
      five: 5,
      fifth: 5,
    }

    for (const [word, num] of Object.entries(numberWords)) {
      if (command.includes(word)) {
        return num
      }
    }

    const digitMatch = command.match(/\d+/)
    if (digitMatch) {
      return Number.parseInt(digitMatch[0])
    }

    return 1
  }

  // perform search with given query
  async performSearch(query) {
    if (!query) return

    this.currentQuery = query
    this.updateFeedback(`Searching for "${query}"`)

    try {
      // send search request to backend
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query }),
      })

      const data = await response.json()

      if (data.success) {
        this.searchResults = data.results
        this.displaySearchResults()
        this.updateFeedback(`Found ${data.results.length} results. Say "select result 1" to view the first one.`)
      } else {
        this.showError("Search failed. Please try again.")
      }
    } catch (error) {
      console.log("Search error:", error)
      this.showError("Network error. Please check your connection.")
    }
  }

  // display search results in frontend
  displaySearchResults() {
    if (this.searchResults.length === 0) {
      this.searchResultsContainer.innerHTML = '<p class="empty-state">No results found.</p>'
      return
    }

    const resultsHTML = this.searchResults
      .map(
        (result, index) => `
        <div class="result-item" tabindex="0" data-result-id="${result.id}" data-result-index="${index}">
          <div class="result-number">${index + 1}</div>
          <h3 class="result-title">${result.title}</h3>
          <p class="result-snippet">${result.snippet}</p>
        </div>
      `,
      )
      .join("")

    this.searchResultsContainer.innerHTML = resultsHTML

    this.searchResultsContainer.querySelectorAll(".result-item").forEach((item, index) => {
      item.addEventListener("click", () => this.selectResult(index + 1))
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          this.selectResult(index + 1)
        }
      })
    })
  }

  // selecting result to view content of website
  async selectResult(resultNumber) {
    if (!resultNumber || resultNumber < 1 || resultNumber > this.searchResults.length) {
      this.updateFeedback(
        "Invalid result number. Try saying 'select result 1' through 'select result " +
          this.searchResults.length +
          "'",
      )
      return
    }

    const result = this.searchResults[resultNumber - 1]
    this.updateFeedback(`Opening "${result.title}"...`)

    this.searchResultsContainer.querySelectorAll(".result-item").forEach((item, index) => {
      item.classList.toggle("selected", index === resultNumber - 1)
    })

    try {
      const response = await fetch(`/api/content/${result.id}`)
      const data = await response.json()

      if (data.success) {
        this.displayContent(data.content)
        this.updateFeedback(`Now reading "${data.content.title}"`)
        this.speakContent(data.content.content)
      } else {
        this.showError("Failed to load content.")
      }
    } catch (error) {
      console.log("[Content loading error:", error)
      this.showError("Error loading content.")
    }
  }

  // display content in main area
  displayContent(content) {
    this.mainContentArea.innerHTML = `
      <h3 class="content-title">${content.title}</h3>
      <div class="content-text">${content.content}</div>
    `
  }

  // add certain result to filtered collection
  addToFiltered(resultNumber) {
    if (!resultNumber || resultNumber < 1 || resultNumber > this.searchResults.length) {
      this.updateFeedback("Invalid result number. Please try again.")
      return
    }

    const result = this.searchResults[resultNumber - 1]

    if (this.filteredResults.find((r) => r.id === result.id)) {
      this.updateFeedback(`"${result.title}" is already saved`)
      return
    }

    this.filteredResults.push(result)
    this.displayFilteredResults()
    this.updateFeedback(`Saved "${result.title}" to your collection`)
  }

  // display filtered results
  displayFilteredResults() {
    if (this.filteredResults.length === 0) {
      this.filteredResultsContainer.innerHTML = `<p class="empty-state">No results selected yet. ${this.voiceSupported ? "Say" : "Type"} "add result" followed by a number to add items here.</p>`
      return
    }

    const resultsHTML = this.filteredResults
      .map(
        (result, index) => `
        <div class="result-item" tabindex="0" data-result-id="${result.id}">
          <div class="result-number">${index + 1}</div>
          <h3 class="result-title">${result.title}</h3>
          <p class="result-snippet">${result.snippet}</p>
        </div>
      `,
      )
      .join("")

    this.filteredResultsContainer.innerHTML = resultsHTML
  }

  // clear all results and reset state
  clearResults() {
    this.searchResults = []
    this.filteredResults = []
    this.currentQuery = ""
    this.searchResultsContainer.innerHTML = `<p class="loading-text">${this.voiceSupported ? 'Say "search for [your query]"' : "Enter a search query above"} to get started...</p>`
    this.filteredResultsContainer.innerHTML = `<p class="empty-state">No results selected yet. ${this.voiceSupported ? "Say" : "Type"} "add result" followed by a number to add items here.</p>`
    this.mainContentArea.innerHTML = '<p class="empty-state">Select a result to view its content here.</p>'

    this.updateFeedback("Results cleared - ready for new search")
  }

  // use speech synthesis to read content aloud
  speakContent(text) {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.9
      utterance.pitch = 1
      utterance.volume = 0.8

      utterance.onend = () => {
        setTimeout(() => {
          this.updateFeedback("Ready for your next command")
        }, 500)
      }

      speechSynthesis.speak(utterance)
    }
  }

  // update feedback text in frontend
  updateFeedback(message) {
    this.feedbackText.textContent = message
    console.log("Feedback:", message)
  }

  // show error message in feedback
  showError(message) {
    this.updateFeedback(`${message}`)

    setTimeout(() => {
      this.updateFeedback("Ready for your next search")
    }, 4000)
  }

  setupEventListeners() {
    this.voiceIndicator.addEventListener("click", () => {
      speechSynthesis.cancel()

      if (this.isListening) {
        this.stopListening()
      } else {
        this.startListening()
      }
    })

    this.searchButton.addEventListener("click", () => {
      this.processTextInput()
    })

    // spacebar to start/stop listening, escape to stop all audio, enter to submit text input
    document.addEventListener("keydown", (e) => {
      if (e.key === " " && e.target === document.body) {
        e.preventDefault()
        speechSynthesis.cancel()

        if (this.voiceSupported) {
          if (this.isListening) {
            this.stopListening()
          } else {
            this.startListening()
          }
        }
      }

      if (e.key === "Escape") {
        if ("speechSynthesis" in window) {
          speechSynthesis.cancel()
        }
        if (this.voiceSupported) {
          this.stopListening()
        }
        this.updateFeedback("Audio stopped. Ready for next command.")
      }
    })

    this.textSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault()
        this.processTextInput()
      }
    })
  }

  // announce heard command and proceed with callback
  announceHeardCommand(command, callback) {
    this.updateFeedback(`You said: "${command}"`)

    if ("speechSynthesis" in window) {
      speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(`You said: ${command}`)
      utterance.rate = 1.0
      utterance.pitch = 1
      utterance.volume = 0.8

      utterance.onend = () => {
        callback()

        setTimeout(() => {
          this.announceListening()
        }, 1000)
      }

      speechSynthesis.speak(utterance)
    } else {
      callback()
      setTimeout(() => {
        this.announceListening()
      }, 2000)
    }
  }

  // announce that website is listening
  announceListening() {
    this.updateFeedback("Listening...")

    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance("Listening")
      utterance.rate = 1.0
      utterance.pitch = 1
      utterance.volume = 0.8

      utterance.onend = () => {
        if (this.voiceSupported && !this.isListening) {
          this.startListening()
        }
      }
      
      speechSynthesis.speak(utterance)
    } else {
      if (this.voiceSupported && !this.isListening) {
        this.startListening()
      }
    }
  }
}

// initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  console.log("Initializing Voice Search App")
  new VoiceSearchApp()
})
