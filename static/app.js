class VoiceSearchApp {
  constructor() {
    this.searchResults = []
    this.filteredResults = []
    this.currentQuery = ""
    this.recognition = null
    this.isListening = false
    this.voiceSupported = false

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
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

      try {
        this.recognition = new SpeechRecognition()
        this.recognition.continuous = false
        this.recognition.interimResults = false
        this.recognition.lang = "en-US"

        this.recognition.onstart = () => {
          this.isListening = true
          this.voiceIndicator.classList.add("listening")
          this.updateFeedback("🎤 Listening...")
        }

        this.recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript
          console.log("[v0] Voice input received:", transcript)
          this.processCommand(transcript)
        }

        this.recognition.onend = () => {
          this.isListening = false
          this.voiceIndicator.classList.remove("listening")
        }

        this.recognition.onerror = (event) => {
          console.log("[v0] Speech recognition error:", event.error)
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
        console.log("[v0] Voice recognition initialized successfully")
      } catch (error) {
        console.log("[v0] Voice recognition initialization failed:", error)
        this.showVoiceFallback("Voice recognition not supported. Using text input.")
      }
    } else {
      console.log("[v0] Speech recognition not supported in this browser")
      this.showVoiceFallback("Voice recognition not supported in this browser. Using text input.")
    }
  }

  initializeInterface() {
    if (this.voiceSupported) {
      this.voiceIndicator.style.display = "flex"
      this.inputFallback.style.display = "none"
      this.updateFeedback("Ready to search - speak your query")
      this.startListening()
    } else {
      this.showVoiceFallback("Using text-based search interface.")
    }

    this.searchResultsContainer.innerHTML =
      '<p class="loading-text">Say "search for [your query]" or enter text above to get started...</p>'
  }

  showVoiceFallback(message) {
    this.voiceSupported = false
    this.voiceIndicator.style.display = "none"
    this.inputFallback.style.display = "block"
    this.updateFeedback(message)
    this.textSearchInput.focus()
  }

  startListening() {
    if (!this.voiceSupported || this.isListening || !this.recognition) return

    try {
      this.recognition.start()
    } catch (error) {
      console.log("[v0] Failed to start recognition:", error)
      this.showVoiceFallback("Voice recognition error. Using text input.")
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop()
    }
  }

  processTextInput() {
    const query = this.textSearchInput.value.trim()
    if (!query) {
      this.updateFeedback("Please enter a search query.")
      return
    }

    this.processCommand(query)
    this.textSearchInput.value = ""
  }

  processCommand(command) {
    const lowerCommand = command.toLowerCase()
    console.log("[v0] Processing command:", lowerCommand)

    this.announceHeardCommand(command, () => {
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

  async performSearch(query) {
    if (!query) return

    this.currentQuery = query
    this.updateFeedback(`🔍 Searching for "${query}"...`)

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query }),
      })

      const data = await response.json()

      if (data.success) {
        this.searchResults = data.results
        this.displaySearchResults()
        this.updateFeedback(`✅ Found ${data.results.length} results. Say "select result 1" to view the first one.`)
      } else {
        this.showError("Search failed. Please try again.")
      }
    } catch (error) {
      console.log("[v0] Search error:", error)
      this.showError("Network error. Please check your connection.")
    }
  }

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
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          this.selectResult(index + 1)
        }
      })
    })
  }

  async selectResult(resultNumber) {
    if (!resultNumber || resultNumber < 1 || resultNumber > this.searchResults.length) {
      this.updateFeedback(
        "❌ Invalid result number. Try saying 'select result 1' through 'select result " +
          this.searchResults.length +
          "'",
      )
      return
    }

    const result = this.searchResults[resultNumber - 1]
    this.updateFeedback(`📖 Opening "${result.title}"...`)

    this.searchResultsContainer.querySelectorAll(".result-item").forEach((item, index) => {
      item.classList.toggle("selected", index === resultNumber - 1)
    })

    try {
      const response = await fetch(`/api/content/${result.id}`)
      const data = await response.json()

      if (data.success) {
        this.displayContent(data.content)
        this.updateFeedback(`📄 Now reading "${data.content.title}"`)
        this.speakContent(data.content.content)
      } else {
        this.showError("Failed to load content.")
      }
    } catch (error) {
      console.log("[v0] Content loading error:", error)
      this.showError("Error loading content.")
    }
  }

  displayContent(content) {
    this.mainContentArea.innerHTML = `
      <h3 class="content-title">${content.title}</h3>
      <div class="content-text">${content.content}</div>
    `
  }

  addToFiltered(resultNumber) {
    if (!resultNumber || resultNumber < 1 || resultNumber > this.searchResults.length) {
      this.updateFeedback("❌ Invalid result number. Please try again.")
      return
    }

    const result = this.searchResults[resultNumber - 1]

    if (this.filteredResults.find((r) => r.id === result.id)) {
      this.updateFeedback(`⚠️ "${result.title}" is already saved`)
      return
    }

    this.filteredResults.push(result)
    this.displayFilteredResults()
    this.updateFeedback(`✅ Saved "${result.title}" to your collection`)
  }

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

  clearResults() {
    this.searchResults = []
    this.filteredResults = []
    this.currentQuery = ""

    this.searchResultsContainer.innerHTML = `<p class="loading-text">${this.voiceSupported ? 'Say "search for [your query]"' : "Enter a search query above"} to get started...</p>`
    this.filteredResultsContainer.innerHTML = `<p class="empty-state">No results selected yet. ${this.voiceSupported ? "Say" : "Type"} "add result" followed by a number to add items here.</p>`
    this.mainContentArea.innerHTML = '<p class="empty-state">Select a result to view its content here.</p>'

    this.updateFeedback("🗑️ Results cleared - ready for new search")
  }

  speakContent(text) {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.9
      utterance.pitch = 1
      utterance.volume = 0.8

      utterance.onend = () => {
        setTimeout(() => {
          this.updateFeedback("🎤 Ready for your next command")
        }, 500)
      }

      speechSynthesis.speak(utterance)
    }
  }

  updateFeedback(message) {
    this.feedbackText.textContent = message
    console.log("[v0] Feedback:", message)
  }

  showError(message) {
    this.updateFeedback(`❌ ${message}`)

    setTimeout(() => {
      this.updateFeedback("🎤 Ready for your next search")
    }, 4000)
  }

  setupEventListeners() {
    this.voiceIndicator.addEventListener("click", () => {
      if (this.isListening) {
        this.stopListening()
      } else {
        this.startListening()
      }
    })

    document.addEventListener("keydown", (e) => {
      if (e.key === " " && e.target === document.body) {
        e.preventDefault()
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

    this.searchButton.addEventListener("click", () => {
      this.processTextInput()
    })

    this.textSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault()
        this.processTextInput()
      }
    })
  }

  announceHeardCommand(command, callback) {
    this.updateFeedback(`You said: "${command}"`)

    if ("speechSynthesis" in window) {
      speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(`You said: ${command}`)
      utterance.rate = 1.0
      utterance.pitch = 1
      utterance.volume = 0.8

      utterance.onend = () => {
        // Execute the command
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

document.addEventListener("DOMContentLoaded", () => {
  console.log("[v0] Initializing Voice Search App")
  new VoiceSearchApp()
})
