import { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  title?: string;
}

const PageContainer = ({ children, title }: PageContainerProps) => {
  // More generous margins on all sides with rounded border
  return (
    <section className="min-h-screen p-8 md:p-12 transition-all duration-300 ml-28 bg-background/50 border rounded-xl shadow-sm my-16 mr-16">
      {title && (
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
      )}
      <div className="flex flex-col space-y-10">
        {children}
      </div>
    </section>
  );
};

export default PageContainer;