import { CloudArrowUpIcon } from '@heroicons/react/24/outline';

export default function Upload() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-100">
        Upload Video
      </h1>
      <div className="mt-8">
        <div className="max-w-xl">
          <div className="mt-4 flex justify-center px-4 md:px-6 pt-5 pb-6 border-2 border-gray-800 border-dashed rounded-lg hover:border-purple-500 transition-colors">
            <div className="space-y-1 text-center">
              <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex flex-col md:flex-row items-center text-sm text-gray-400">
                <label className="relative cursor-pointer rounded-md font-medium text-purple-500 hover:text-purple-400 focus-within:outline-none">
                  <span>Upload a file</span>
                  <input type="file" className="sr-only" accept="video/*" />
                </label>
                <p className="md:pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">MP4, MOV up to 100MB</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}