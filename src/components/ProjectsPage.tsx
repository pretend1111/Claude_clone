import React, { useState, useEffect } from 'react';
import { Search, Plus, ChevronDown } from 'lucide-react';

const ProjectsPage = () => {
  console.log('Rendering ProjectsPage');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Mock data to match the screenshot
  const projects = [
    {
      id: '1',
      title: 'yolo',
      description: 'rm',
      updatedAt: 'Updated 1 day ago',
      isExample: false
    },
    {
      id: '2',
      title: 'How to use Claude',
      description: 'An example project that also doubles as a how-to guide for using Claude. Chat with it to learn more about how to get the most out of chatting with Claude!',
      updatedAt: 'Updated 1 month ago',
      isExample: true
    }
  ];

  useEffect(() => {
    // Inject Spectral font for the title
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    
    return () => {
      // Check if the link is still a child of document.head before removing
      if (document.head.contains(link)) {
        document.head.removeChild(link);
      }
    };
  }, []);

  const filteredProjects = projects.filter(project => 
    project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 h-full bg-claude-bg overflow-y-auto">
      <div className="max-w-[1000px] mx-auto px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 
            className="font-[Spectral] text-[32px] text-claude-text" 
            style={{
              fontWeight: 500,
              WebkitTextStroke: '0.5px currentColor'
            }}
          >
            Projects
          </h1>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-lg hover:opacity-90 transition-opacity font-medium text-[14px]"
          >
            <Plus size={18} />
            New project
          </button>
        </div>

        <div className="flex flex-col gap-4 mb-8">
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-claude-input border border-gray-200 dark:border-claude-border rounded-xl text-claude-text focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-[15px]"
            />
          </div>
          
          <div className="flex justify-end">
            <div className="flex items-center gap-2 text-[14px] text-claude-textSecondary">
              <span>Sort by</span>
              <button className="flex items-center gap-1 font-medium text-claude-text hover:bg-black/5 dark:hover:bg-white/10 px-2 py-1 rounded-md transition-colors">
                Activity
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map((project) => (
            <div 
              key={project.id}
              className="group relative p-5 bg-white dark:bg-claude-input border border-gray-200 dark:border-claude-border rounded-xl hover:border-gray-300 dark:hover:border-gray-600 transition-all cursor-pointer h-[160px] flex flex-col"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-[16px] font-semibold text-claude-text">
                    {project.title}
                  </h3>
                  {project.isExample && (
                    <span className="px-1.5 py-0.5 text-[11px] font-medium text-claude-textSecondary bg-gray-100 dark:bg-gray-800 rounded">
                      Example project
                    </span>
                  )}
                </div>
              </div>
              
              <p className="text-[14px] text-claude-textSecondary line-clamp-3 mb-auto">
                {project.description}
              </p>
              
              <div className="mt-4 text-[13px] text-gray-400">
                {project.updatedAt}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectsPage;
