import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Search, Shield, MessageCircle, Phone, UserPlus, FileText, ExternalLink, ChevronRight, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import serverLogo from '@/assets/server-logo.png';

// Types for knowledgebase data
interface ArticleStub {
  id: string;
  title: string;
  slug: string;
  ordinal: number;
}

interface CategoryWithArticles {
  id: string;
  name: string;
  slug: string;
  description?: string;
  ordinal: number;
  articles: ArticleStub[];
}

const HomePage: React.FC = () => {
  const [categories, setCategories] = useState<CategoryWithArticles[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ArticleStub[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch categories on component mount
  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/public/knowledgebase/categories');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setCategories(data);
      } catch (e: any) {
        console.error('Failed to load categories:', e);
        setCategories([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // Handle search with debouncing
  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const handleSearch = async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/public/knowledgebase/search?q=${encodeURIComponent(searchTerm)}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setSearchResults(data);
      } catch (e: any) {
        console.error('Search failed:', e);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceSearch = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(debounceSearch);
  }, [searchTerm]);

  // Show all categories instead of just first 4
  const allCategories = categories;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      {/* Logo and Search Section */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto text-center">
          {/* Large Logo */}
          <div className="w-32 h-32 mx-auto mb-6">
            <img src={serverLogo} alt="COBL Logo" className="w-full h-full object-contain" />
          </div>
          
          {/* Descriptive Text */}
          <p className="text-white text-lg mb-8">Search our knowledgebase or contact us here</p>
          
          {/* Search Bar */}
          <div className="max-w-xl mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Search knowledgebase..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 py-3 rounded-full border-2 focus:border-primary shadow-md"
              />
            </div>
            
            {/* Search Results */}
            {searchTerm.trim().length >= 2 && (
              <Card className="mt-3 text-left max-h-48 overflow-y-auto">
                <CardContent className="p-3">
                  {isSearching ? (
                    <p className="text-center text-muted-foreground text-sm">Searching...</p>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-1">
                      {searchResults.map(article => (
                        <Link key={article.id} href={`/${article.slug}`}>
                          <div className="p-2 rounded hover:bg-muted/50 transition-colors cursor-pointer">
                            <p className="text-sm font-medium text-primary hover:underline">{article.title}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground text-sm">
                      No articles found for "{searchTerm}"
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>      {/* Quick Actions - Compact */}
      <section className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            
            {/* Staff Sign-in */}
            <Card className="group hover:shadow-md transition-all duration-300 hover:-translate-y-1 h-40">
              <CardContent className="p-6 text-center h-full flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-medium text-base mb-3">Staff Portal</h3>
                </div>
                <Link href="/panel/auth">
                  <Button variant="outline" size="sm" className="w-full">
                    Sign In
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Ban Appeals */}
            <Card className="group hover:shadow-md transition-all duration-300 hover:-translate-y-1 h-40">
              <CardContent className="p-6 text-center h-full flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-amber-500/20 transition-colors">
                    <FileText className="h-6 w-6 text-amber-600" />
                  </div>
                  <h3 className="font-medium text-base mb-3">Ban Appeals</h3>
                </div>
                <Link href="/appeals">
                  <Button variant="outline" size="sm" className="w-full">
                    Submit Appeal
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Contact Support */}
            <Card className="group hover:shadow-md transition-all duration-300 hover:-translate-y-1 h-40">
              <CardContent className="p-6 text-center h-full flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-green-500/20 transition-colors">
                    <MessageCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="font-medium text-base mb-3">Contact Support</h3>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  Contact Us
                </Button>
              </CardContent>
            </Card>

            {/* Applications */}
            <Card className="group hover:shadow-md transition-all duration-300 hover:-translate-y-1 h-40">
              <CardContent className="p-6 text-center h-full flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-500/20 transition-colors">
                    <UserPlus className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="font-medium text-base mb-3">Applications</h3>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  Apply Now
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Knowledge Base Categories */}
      <section className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Card key={i} className="animate-pulse h-32">
                  <CardContent className="p-6 h-full flex flex-col">
                    <div className="h-4 bg-muted rounded w-3/4 mb-3"></div>
                    <div className="h-3 bg-muted rounded w-full mb-2"></div>
                    <div className="h-2 bg-muted rounded w-2/3 mt-auto"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : allCategories.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {allCategories.map((category: CategoryWithArticles) => (
                <Card key={category.id} className="group hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer h-32">
                  <CardContent className="p-6 h-full flex flex-col justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-base mb-1 truncate">{category.name}</h3>
                        {category.description && (
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{category.description}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-auto">
                      {category.articles.length} article{category.articles.length !== 1 ? 's' : ''}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="h-32">
              <CardContent className="py-8 text-center h-full flex flex-col justify-center">
                <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No categories available</p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
};

export default HomePage;