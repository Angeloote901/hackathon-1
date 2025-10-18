/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import {Content, GoogleGenAI, Modality} from '@google/genai';
import {
  ChevronDown,
  Home as HomeIcon,
  LoaderCircle,
  SendHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

function parseError(error: string) {
  const regex = /{"error":(.*)}/gm;
  const m = regex.exec(error);
  try {
    const e = m[1];
    const err = JSON.parse(e);
    return err.message || error;
  } catch (e) {
    return error;
  }
}

export default function Home() {
  const [isGameStarted, setIsGameStarted] = useState(false);
  const canvasRef = useRef(null);
  const backgroundImageRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#FFFFFF');
  const colorInputRef = useRef(null);
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash-image');
  const [selectedTheme, setSelectedTheme] = useState('none');

  // Load background image when generatedImage changes
  useEffect(() => {
    if (generatedImage && canvasRef.current) {
      // Use the window.Image constructor to avoid conflict with Next.js Image component
      const img = new window.Image();
      img.onload = () => {
        backgroundImageRef.current = img;
        drawImageToCanvas();
      };
      img.src = generatedImage;
    }
  }, [generatedImage]);

  // Initialize canvas with white background when component mounts
  useEffect(() => {
    if (isGameStarted && canvasRef.current) {
      initializeCanvas();
    }
  }, [isGameStarted]);

  // Initialize canvas with white background
  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Fill canvas with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  // Draw the background image to the canvas
  const drawImageToCanvas = () => {
    if (!canvasRef.current || !backgroundImageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Fill with white background first
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the background image
    ctx.drawImage(
      backgroundImageRef.current,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  };

  // Get the correct coordinates based on canvas scaling
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Calculate the scaling factor between the internal canvas size and displayed size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Apply the scaling to get accurate coordinates
    return {
      x:
        (e.nativeEvent.offsetX ||
          e.nativeEvent.touches?.[0]?.clientX - rect.left) * scaleX,
      y:
        (e.nativeEvent.offsetY ||
          e.nativeEvent.touches?.[0]?.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const {x, y} = getCoordinates(e);

    // Prevent default behavior to avoid scrolling on touch devices
    if (e.type === 'touchstart') {
      e.preventDefault();
    }

    // Start a new path without clearing the canvas
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;

    // Prevent default behavior to avoid scrolling on touch devices
    if (e.type === 'touchmove') {
      e.preventDefault();
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const {x, y} = getCoordinates(e);

    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = penColor;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Fill with white instead of just clearing
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    setGeneratedImage(null);
    backgroundImageRef.current = null;
  };

  const handleColorChange = (e) => {
    setPenColor(e.target.value);
  };

  const openColorPicker = () => {
    if (colorInputRef.current) {
      colorInputRef.current.click();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      openColorPicker();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canvasRef.current) return;

    setIsLoading(true);

    try {
      // Get the drawing as base64 data
      const canvas = canvasRef.current;

      // Create a temporary canvas to add white background
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');

      // Fill with white background
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      // Draw the original canvas content on top of the white background
      tempCtx.drawImage(canvas, 0, 0);

      const drawingData = tempCanvas.toDataURL('image/png').split(',')[1];

      // Create request payload
      const requestPayload = {
        prompt,
        drawingData,
        customApiKey, // Add the custom API key to the payload if it exists
      };

      // Log the request payload (without the full image data for brevity)
      console.log('Request payload:', {
        ...requestPayload,
        drawingData: drawingData
          ? `${drawingData.substring(0, 50)}... (truncated)`
          : null,
        customApiKey: customApiKey ? '**********' : null,
      });

      let finalPrompt = prompt;
      if (selectedTheme !== 'none') {
        const themeText = selectedTheme.replace(/-/g, ' ');
        finalPrompt = `${prompt}, in the style of ${themeText}`;
      }

      const contents: Content[] = [
        {
          role: 'USER',
          parts: [{inlineData: {data: drawingData, mimeType: 'image/png'}}],
        },
        {
          role: 'USER',
          parts: [
            {
              text: `${finalPrompt}. Keep the same minimal line drawing style.`,
            },
          ],
        },
      ];

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      const data = {
        success: true,
        message: '',
        imageData: null,
        error: undefined,
      };

      for (const part of response.candidates[0].content.parts) {
        // Based on the part type, either get the text or image data
        if (part.text) {
          data.message = part.text;
          console.log('Received text response:', part.text);
        } else if (part.inlineData) {
          const imageData = part.inlineData.data;
          console.log('Received image data, length:', imageData.length);

          // Include the base64 data in the response
          data.imageData = imageData;
        }
      }

      // Log the response (without the full image data for brevity)
      console.log('Response:', {
        ...data,
        imageData: data.imageData
          ? `${data.imageData.substring(0, 50)}... (truncated)`
          : null,
      });

      if (data.success && data.imageData) {
        const imageUrl = `data:image/png;base64,${data.imageData}`;
        setGeneratedImage(imageUrl);
      } else {
        console.error('Failed to generate image:', data.error);
        alert('Failed to generate image. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting drawing:', error);
      setErrorMessage(error.message || 'An unexpected error occurred.');
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Close the error modal
  const closeErrorModal = () => {
    setShowErrorModal(false);
  };

  // Handle the custom API key submission
  const handleApiKeySubmit = (e) => {
    e.preventDefault();
    setShowErrorModal(false);
    // Will use the customApiKey state in the next API call
  };

  // Add touch event prevention function
  useEffect(() => {
    // Function to prevent default touch behavior on canvas
    const preventTouchDefault = (e) => {
      if (isDrawing) {
        e.preventDefault();
      }
    };

    // Add event listener when component mounts
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('touchstart', preventTouchDefault, {
        passive: false,
      });
      canvas.addEventListener('touchmove', preventTouchDefault, {
        passive: false,
      });
    }

    // Remove event listener when component unmounts
    return () => {
      if (canvas) {
        canvas.removeEventListener('touchstart', preventTouchDefault);
        canvas.removeEventListener('touchmove', preventTouchDefault);
      }
    };
  }, [isDrawing]);

  if (!isGameStarted) {
    return (
      <>
        <div className="stars-bg"></div>
        <div className="min-h-screen w-full flex flex-col justify-center items-center text-center p-4 relative z-10">
          <h1
            className="text-7xl sm:text-9xl font-bold font-mega text-white mb-10"
            style={{
              textShadow:
                '0 0 25px rgba(129, 140, 248, 1), 0 0 10px rgba(255, 255, 255, 0.7)',
            }}>
            game_1
          </h1>
          <button
            onClick={() => setIsGameStarted(true)}
            className="px-12 py-5 bg-indigo-600 text-white text-2xl font-bold rounded-full shadow-lg shadow-indigo-500/50 transform hover:scale-105 transition-transform duration-300 ease-in-out border-2 border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-300 animate-pulse">
            Start
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="stars-bg"></div>
      <div className="min-h-screen text-gray-100 flex flex-col justify-start items-center">
        <main className="container mx-auto px-3 sm:px-6 py-5 sm:py-10 pb-32 max-w-5xl w-full relative z-10">
          {/* Header section with title and tools */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-2 sm:mb-6 gap-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-0 leading-tight font-mega text-white">
                Gemini Co-Drawing
              </h1>
              <p className="text-sm sm:text-base text-gray-300 mt-1">
                Built with{' '}
                <a
                  className="underline text-indigo-400 hover:text-indigo-300"
                  href="https://ai.google.dev/gemini-api/docs/image-generation"
                  target="_blank"
                  rel="noopener noreferrer">
                  Gemini native image generation
                </a>
              </p>
              <p className="text-sm sm:text-base text-gray-300 mt-1">
                by{' '}
                <a
                  className="underline text-indigo-400 hover:text-indigo-300"
                  href="https://x.com/trudypainter"
                  target="_blank"
                  rel="noopener noreferrer">
                  @trudypainter
                </a>{' '}
                and{' '}
                <a
                  className="underline text-indigo-400 hover:text-indigo-300"
                  href="https://x.com/alexanderchen"
                  target="_blank"
                  rel="noopener noreferrer">
                  @alexanderchen
                </a>
              </p>
            </div>

            <menu className="flex items-center flex-wrap gap-2 bg-indigo-900/50 backdrop-blur-sm border border-indigo-500/50 rounded-full p-2 shadow-lg self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setIsGameStarted(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-800/80 border-2 border-indigo-500/50 shadow-lg transition-all hover:bg-gray-700/80 hover:scale-110"
                aria-label="Go to Home Screen">
                <HomeIcon className="w-5 h-5 text-gray-200" />
              </button>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="h-10 rounded-full bg-gray-800/80 pl-3 pr-8 text-sm text-white shadow-sm transition-all hover:bg-gray-700/80 focus:outline-none focus:ring-2 focus:ring-indigo-400 appearance-none border-2 border-indigo-500/50"
                  aria-label="Select Gemini Model">
                  <option value="gemini-2.5-flash-image">2.5 Flash</option>
                  <option value="gemini-2.0-flash-preview-image-generation">
                    2.0 Flash
                  </option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                  <ChevronDown className="w-5 h-5" />
                </div>
              </div>
              <div className="relative">
                <select
                  value={selectedTheme}
                  onChange={(e) => setSelectedTheme(e.target.value)}
                  className="h-10 rounded-full bg-gray-800/80 pl-3 pr-8 text-sm text-white shadow-sm transition-all hover:bg-gray-700/80 focus:outline-none focus:ring-2 focus:ring-indigo-400 appearance-none border-2 border-indigo-500/50"
                  aria-label="Select a theme">
                  <option value="none">No Theme</option>
                  <option value="pirates">Pirates</option>
                  <option value="video-games">Video Games</option>
                  <option value="sci-fi">Sci-Fi</option>
                  <option value="fantasy">Fantasy</option>
                  <option value="cute-animals">Cute Animals</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                  <ChevronDown className="w-5 h-5" />
                </div>
              </div>
              <button
                type="button"
                className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center border-2 border-indigo-500/50 shadow-lg transition-transform hover:scale-110"
                onClick={openColorPicker}
                onKeyDown={handleKeyDown}
                aria-label="Open color picker"
                style={{backgroundColor: penColor}}>
                <input
                  ref={colorInputRef}
                  type="color"
                  value={penColor}
                  onChange={handleColorChange}
                  className="opacity-0 absolute w-px h-px"
                  aria-label="Select pen color"
                />
              </button>
              <button
                type="button"
                onClick={clearCanvas}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-800/80 border-2 border-indigo-500/50 shadow-lg transition-all hover:bg-gray-700/80 hover:scale-110">
                <Trash2
                  className="w-5 h-5 text-gray-200"
                  aria-label="Clear Canvas"
                />
              </button>
            </menu>
          </div>

          {/* Canvas section with notebook paper background */}
          <div className="w-full mb-6">
            <canvas
              ref={canvasRef}
              width={960}
              height={540}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="border-2 border-indigo-400 w-full hover:cursor-crosshair sm:h-[60vh]
                h-[30vh] min-h-[320px] bg-white/95 touch-none rounded-lg shadow-[0_0_15px_rgba(79,70,229,0.5)]"
            />
          </div>

          {/* Input form that matches canvas width */}
          <form onSubmit={handleSubmit} className="w-full">
            <div className="relative">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Add your change..."
                className="w-full p-3 sm:p-4 pr-12 sm:pr-14 text-sm sm:text-base border-2 border-indigo-400 bg-gray-900/70 text-gray-100 placeholder:text-gray-400 shadow-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none transition-all font-mono rounded-lg"
                required
              />
              <button
                type="submit"
                disabled={isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 sm:p-2.5 rounded-md bg-indigo-600 text-white hover:cursor-pointer hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors">
                {isLoading ? (
                  <LoaderCircle
                    className="w-5 sm:w-6 h-5 sm:h-6 animate-spin"
                    aria-label="Loading"
                  />
                ) : (
                  <SendHorizontal
                    className="w-5 sm:w-6 h-5 sm:h-6"
                    aria-label="Submit"
                  />
                )}
              </button>
            </div>
          </form>
        </main>
        {/* Error Modal */}
        {showErrorModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-red-500/50 rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-red-400">
                  Failed to generate
                </h3>
                <button
                  onClick={closeErrorModal}
                  className="text-gray-500 hover:text-gray-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="font-medium text-gray-300">
                {parseError(errorMessage)}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}