import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import skillsImg from '../assets/icons/skills.png';
import connectorsImg from '../assets/icons/connectors.png';
import customizeMainImg from '../assets/icons/customize-main.png';
import connectToolsImg from '../assets/icons/connect-tools.png';
import createSkillsImg from '../assets/icons/create-skills.png';

const CustomizePage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex h-full w-full bg-claude-bg text-claude-text">
      {/* Sub-sidebar / Navigation */}
      <div className="w-[240px] border-r border-claude-border flex flex-col pt-4 pb-4">
        {/* Header */}
        <div className="px-4 mb-6">
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center gap-2 text-claude-text font-medium hover:text-claude-text/80 transition-colors mb-4"
          >
            <ArrowLeft size={20} />
            <span className="text-lg font-semibold">Customize</span>
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 px-2 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2 text-[15px] font-medium text-claude-text hover:bg-claude-hover rounded-lg transition-colors">
            <img src={skillsImg} alt="Skills" className="w-[22px] h-[22px] dark:invert" />
            Skills
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 text-[15px] font-medium text-claude-text hover:bg-claude-hover rounded-lg transition-colors">
            <img src={connectorsImg} alt="Connectors" className="w-[22px] h-[22px] dark:invert" />
            Connectors
          </button>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="max-w-2xl w-full flex flex-col items-center text-center">
          {/* Large Icon */}
          <div className="mb-6">
            <img src={customizeMainImg} alt="Customize" className="w-32 h-32 dark:invert" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-normal text-claude-text mb-12">
            Customize and manage the context and tools you are giving Claude.
          </h2>

          {/* Action Cards */}
          <div className="w-full">
            {/* Connect your tools */}
            <button className="w-full flex items-center justify-between py-6 px-2 hover:bg-claude-hover rounded-xl transition-colors group text-left border-b border-claude-border">
              <div className="flex items-center gap-6">
                <div className="flex-shrink-0">
                  <img src={connectToolsImg} alt="Connect tools" className="w-12 h-12 dark:invert" />
                </div>
                <div>
                  <div className="text-[17px] font-semibold text-claude-text mb-1">Connect your tools</div>
                  <div className="text-[15px] text-claude-textSecondary">Integrate with the tools you use to complete your tasks</div>
                </div>
              </div>
              <ChevronRight size={20} className="text-claude-textSecondary group-hover:text-claude-text transition-colors" />
            </button>

            {/* Create new skills */}
            <button className="w-full flex items-center justify-between py-6 px-2 hover:bg-claude-hover rounded-xl transition-colors group text-left">
              <div className="flex items-center gap-6">
                <div className="flex-shrink-0">
                  <img src={createSkillsImg} alt="Create skills" className="w-12 h-12 dark:invert" />
                </div>
                <div>
                  <div className="text-[17px] font-semibold text-claude-text mb-1">Create new skills</div>
                  <div className="text-[15px] text-claude-textSecondary">Teach Claude your processes, team norms, and expertise</div>
                </div>
              </div>
              <ChevronRight size={20} className="text-claude-textSecondary group-hover:text-claude-text transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomizePage;
