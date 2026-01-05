#!/bin/bash
set -e

echo "🦙 Starting Ollama for tests..."

# Check if ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "Error: Ollama not installed"
    echo "Install from: https://ollama.ai"
    exit 1
fi

# Start Ollama if not running
STARTED_OLLAMA=""
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    ollama serve &
    OLLAMA_PID=$!
    STARTED_OLLAMA="true"
    echo "Started Ollama (PID: $OLLAMA_PID)"

    # Wait for ready
    echo "Waiting for Ollama to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            echo "Ollama ready"
            break
        fi
        sleep 1
    done
else
    echo "Ollama already running"
fi

# Ensure model is available
MODEL="llama3.2"
if ! ollama list 2>/dev/null | grep -q "$MODEL"; then
    echo "Pulling $MODEL model..."
    ollama pull $MODEL
fi

# Run tests
echo ""
echo "🧪 Running tests..."
echo ""
npm run test:run
TEST_EXIT_CODE=$?

# Cleanup
if [ -n "$STARTED_OLLAMA" ]; then
    echo ""
    echo "Stopping Ollama..."
    kill $OLLAMA_PID 2>/dev/null || true
fi

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All tests passed"
else
    echo "❌ Some tests failed"
fi

exit $TEST_EXIT_CODE
