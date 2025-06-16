import React from 'react';
import ReactMarkdown from 'react-markdown';

interface ArticleDisplayProps {
  title: string;
  content: string;
  updatedAt: string; // ISO date string
}

const ArticleDisplay: React.FC<ArticleDisplayProps> = ({ title, content, updatedAt }) => {
  return (
    <article className="prose lg:prose-xl max-w-none bg-white p-6 rounded-lg shadow">
      <h1 className="text-3xl font-bold mb-4 text-gray-900">{title}</h1>
      <div className="text-sm text-gray-500 mb-4">
        <span>Last updated: {new Date(updatedAt).toLocaleDateString()}</span>
      </div>
      <ReactMarkdown>{content}</ReactMarkdown>
    </article>
  );
};

export default ArticleDisplay;