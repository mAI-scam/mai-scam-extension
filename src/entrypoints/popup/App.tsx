import { useState } from 'react';
import reactLogo from '@/assets/react.svg';
import wxtLogo from '/wxt.svg';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="max-w-5xl mx-auto p-8 text-center">
      <div className="flex items-center justify-center gap-4">
        <a href="https://wxt.dev" target="_blank">
          <img 
            src={wxtLogo} 
            className="h-24 p-6 transition-all duration-300 hover:drop-shadow-[0_0_2em_#54bc4ae0]" 
            alt="WXT logo" 
          />
        </a>
        <a href="https://react.dev" target="_blank">
          <img 
            src={reactLogo} 
            className="h-24 p-6 transition-all duration-300 hover:drop-shadow-[0_0_2em_#61dafbaa] motion-safe:animate-spin [animation-duration:20s]" 
            alt="React logo" 
          />
        </a>
      </div>
      <h1 className="text-5xl leading-tight mt-6">WXT + React</h1>
      <div className="p-8">
        <button 
          onClick={() => setCount((count) => count + 1)}
          className="rounded-lg border border-transparent px-5 py-3 text-base font-medium cursor-pointer transition-colors duration-250 bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300"
        >
          count is {count}
        </button>
        <p className="mt-8">
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="text-gray-500 mb-6">
        Click on the WXT and React logos to learn more
      </p>
    </div>
  );
}

export default App;
