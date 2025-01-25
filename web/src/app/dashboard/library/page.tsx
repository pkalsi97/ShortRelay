export default function Library() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-100">
        Your Videos
      </h1>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <div className="aspect-video bg-gray-800"></div>
          <div className="p-4">
            <h3 className="text-gray-100 font-medium">Video Title</h3>
            <p className="mt-1 text-sm text-gray-400">Uploaded on Jan 23, 2024</p>
            <div className="mt-4 flex justify-between items-center">
              <span className="text-xs text-gray-500">Processing</span>
              <button className="text-purple-500 hover:text-purple-400">
                View Details
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}