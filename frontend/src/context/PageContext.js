import React, { createContext, useContext, useState } from 'react';

/**
 * PageContext - Provides page awareness for the Help Chatbot
 *
 * This context tracks the current page, active tab, and other metadata
 * so the Help Chatbot can provide context-aware assistance.
 */

const PageContext = createContext();

export const PageContextProvider = ({ children }) => {
  const [pageState, setPageState] = useState({
    pageName: '',
    pageTitle: '',
    activeTab: null,
    activeFeature: null,
    metadata: {},
  });

  const updatePageContext = (updates) => {
    setPageState(prev => ({ ...prev, ...updates }));
  };

  const clearPageContext = () => {
    setPageState({
      pageName: '',
      pageTitle: '',
      activeTab: null,
      activeFeature: null,
      metadata: {},
    });
  };

  return (
    <PageContext.Provider value={{
      ...pageState,
      updatePageContext,
      clearPageContext
    }}>
      {children}
    </PageContext.Provider>
  );
};

export const usePageContext = () => {
  const context = useContext(PageContext);
  if (!context) {
    // Return default values if used outside provider
    return {
      pageName: '',
      pageTitle: '',
      activeTab: null,
      activeFeature: null,
      metadata: {},
      updatePageContext: () => {},
      clearPageContext: () => {},
    };
  }
  return context;
};

export default PageContext;
