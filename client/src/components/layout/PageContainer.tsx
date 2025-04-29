import { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  title?: string;
}

const PageContainer = ({ children, title }: PageContainerProps) => {
  // More generous margins on all sides
  return (
    <section className="min-h-screen p-6 md:p-10 transition-all duration-300 ml-[32px] pl-10 pr-10 pb-10">
      {title && (
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
      )}
      <div className="flex flex-col space-y-8">
        {children}
      </div>
    </section>
  );
};

export default PageContainer;