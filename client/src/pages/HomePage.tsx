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

  // Get first 4 categories for homepage display
  const featuredCategories = categories.slice(0, 4);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      {/* Compact Hero Section */}
      <section className="py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          {/* Logo Space */}
          <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden">
            <img src={serverLogo} alt="COBL Logo" className="w-12 h-12 object-contain" />
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Welcome to COBL
          </h1>
          
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
      </section>

      {/* Quick Actions - Compact */}
      <section className="py-6 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* Staff Sign-in */}
            <Card className="group hover:shadow-md transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-4 text-center">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-primary/20 transition-colors">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-medium text-sm mb-2">Staff Portal</h3>
                <Link href="/panel/auth">
                  <Button size="sm" className="w-full">
                    Sign In
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Ban Appeals */}
            <Card className="group hover:shadow-md transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-4 text-center">
                <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-amber-500/20 transition-colors">
                  <FileText className="h-5 w-5 text-amber-600" />
                </div>
                <h3 className="font-medium text-sm mb-2">Ban Appeals</h3>
                <Link href="/appeals">
                  <Button variant="outline" size="sm" className="w-full">
                    Submit Appeal
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Contact Support */}
            <Card className="group hover:shadow-md transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-4 text-center">
                <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-green-500/20 transition-colors">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                </div>
                <h3 className="font-medium text-sm mb-2">Contact Support</h3>
                <Button variant="outline" size="sm" className="w-full">
                  Contact Us
                </Button>
              </CardContent>
            </Card>

            {/* Applications */}
            <Card className="group hover:shadow-md transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-4 text-center">
                <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-blue-500/20 transition-colors">
                  <UserPlus className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="font-medium text-sm mb-2">Applications</h3>
                <Button variant="outline" size="sm" className="w-full">
                  Apply Now
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Knowledge Base - Compact Cards */}
      <section className="py-6 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Knowledge Base</h2>
            <Link href="/knowledgebase">
              <Button variant="outline" size="sm">
                View All
                <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-3">
                    <div className="h-3 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-2 bg-muted rounded w-full"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : featuredCategories.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {featuredCategories.map(category => (
                <Card key={category.id} className="group hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer">
                  <CardContent className="p-3">
                    <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="font-medium text-sm mb-1">{category.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {category.articles.length} article{category.articles.length !== 1 ? 's' : ''}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No categories available</p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Footer - Compact */}
      <footer className="py-4 px-4 bg-muted/50 border-t">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex justify-center space-x-4 text-sm">
            <Link href="/appeals">
              <Button variant="link" size="sm" className="text-xs">Appeals</Button>
            </Link>
            <Link href="/panel/auth">
              <Button variant="link" size="sm" className="text-xs">Staff Portal</Button>
            </Link>
            <Button variant="link" size="sm" className="text-xs">Contact</Button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;