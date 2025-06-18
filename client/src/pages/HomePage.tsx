import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Search, Shield, MessageCircle, Phone, UserPlus, FileText, ExternalLink, ChevronRight, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
      {/* Hero Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Welcome to COBL
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Your gateway to community resources, support, and staff services
          </p>
          
          {/* Search Bar */}
          <div className="max-w-2xl mx-auto mb-12">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <Input
                type="text"
                placeholder="Search knowledgebase articles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 py-4 text-lg rounded-full border-2 focus:border-primary shadow-lg"
              />
            </div>
            
            {/* Search Results */}
            {searchTerm.trim().length >= 2 && (
              <Card className="mt-4 text-left max-h-64 overflow-y-auto">
                <CardContent className="p-4">
                  {isSearching ? (
                    <p className="text-center text-muted-foreground">Searching...</p>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-2">
                      <p className="font-medium text-sm text-muted-foreground mb-3">
                        Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                      </p>
                      {searchResults.map(article => (
                        <Link key={article.id} href={`/${article.slug}`}>
                          <div className="p-3 rounded-lg hover:bg-muted/50 transition-colors border cursor-pointer">
                            <p className="font-medium text-primary hover:underline">{article.title}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground">
                      No articles found for "{searchTerm}"
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="py-12 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Staff Sign-in */}
            <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="text-center pb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Staff Portal</CardTitle>
                <CardDescription>Access the admin panel</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Link href="/panel/auth">
                  <Button className="w-full group-hover:bg-primary/90">
                    Sign In
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Ban Appeals */}
            <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="text-center pb-4">
                <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-amber-500/20 transition-colors">
                  <FileText className="h-6 w-6 text-amber-600" />
                </div>
                <CardTitle className="text-lg">Ban Appeals</CardTitle>
                <CardDescription>Submit an appeal request</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Link href="/appeals">
                  <Button variant="outline" className="w-full group-hover:border-amber-500 group-hover:text-amber-600">
                    Submit Appeal
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Contact Support */}
            <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="text-center pb-4">
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-green-500/20 transition-colors">
                  <MessageCircle className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle className="text-lg">Contact Support</CardTitle>
                <CardDescription>Get help from our team</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button variant="outline" className="w-full group-hover:border-green-500 group-hover:text-green-600">
                  Contact Us
                  <Phone className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            {/* Applications */}
            <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="text-center pb-4">
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-500/20 transition-colors">
                  <UserPlus className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-lg">Applications</CardTitle>
                <CardDescription>Apply to join our team</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button variant="outline" className="w-full group-hover:border-blue-500 group-hover:text-blue-600">
                  Apply Now
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Featured Knowledgebase */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Knowledge Base</h2>
              <p className="text-muted-foreground">Find answers to common questions</p>
            </div>
            <Link href="/knowledgebase">
              <Button variant="outline">
                View All Categories
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-full"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-muted rounded"></div>
                      <div className="h-3 bg-muted rounded w-5/6"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : featuredCategories.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredCategories.map(category => (
                <Card key={category.id} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <CardHeader className="pb-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{category.name}</CardTitle>
                    {category.description && (
                      <CardDescription className="line-clamp-2">
                        {category.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    {category.articles.length > 0 ? (
                      <div className="space-y-2">
                        {category.articles.slice(0, 3).map(article => (
                          <Link key={article.id} href={`/${article.slug}`}>
                            <div className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer truncate">
                              • {article.title}
                            </div>
                          </Link>
                        ))}
                        {category.articles.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            +{category.articles.length - 3} more articles
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No articles available</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Categories Available</h3>
                <p className="text-muted-foreground">Knowledge base content is being prepared.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-muted/50 border-t">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-muted-foreground">
            © 2024 COBL Community. All rights reserved.
          </p>
          <div className="flex justify-center space-x-6 mt-4">
            <Link href="/appeals">
              <Button variant="link" size="sm">Appeals</Button>
            </Link>
            <Link href="/panel/auth">
              <Button variant="link" size="sm">Staff Portal</Button>
            </Link>
            <Button variant="link" size="sm">Contact</Button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;