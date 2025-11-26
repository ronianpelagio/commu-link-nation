import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Users, ClipboardList, MessageCircle, Shield } from "lucide-react";
const Landing = () => {
  return <div className="min-h-screen bg-gradient-subtle">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-20 sm:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl sm:text-6xl font-bold mb-6 bg-gradient-hero bg-clip-text text-transparent">Bara</h1>
            <p className="text-xl sm:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Strengthening our community through connection, collaboration, and support
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg px-8">
                <Link to="/auth">Get Started</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8">
                <Link to="/auth">Sign In</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
            What We Offer
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            <div className="p-6 rounded-lg border bg-card shadow-soft hover:shadow-medium transition-shadow">
              <div className="w-12 h-12 rounded-full bg-gradient-hero flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Community Feed</h3>
              <p className="text-muted-foreground">
                Share updates, announcements, and connect with your neighbors
              </p>
            </div>

            <div className="p-6 rounded-lg border bg-card shadow-soft hover:shadow-medium transition-shadow">
              <div className="w-12 h-12 rounded-full bg-gradient-warm flex items-center justify-center mb-4">
                <ClipboardList className="w-6 h-6 text-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Task Board</h3>
              <p className="text-muted-foreground">
                Post and accept local tasks, support each other in the community
              </p>
            </div>

            <div className="p-6 rounded-lg border bg-card shadow-soft hover:shadow-medium transition-shadow">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <MessageCircle className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Direct Messaging</h3>
              <p className="text-muted-foreground">
                Connect privately with friends and community members
              </p>
            </div>

            <div className="p-6 rounded-lg border bg-card shadow-soft hover:shadow-medium transition-shadow">
              <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Barangay Support</h3>
              <p className="text-muted-foreground">
                Reach out directly to barangay officials for assistance
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-hero">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-6">
            Join Our Community Today
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Be part of a stronger, more connected barangay
          </p>
          <Button asChild size="lg" variant="secondary" className="text-lg px-8">
            <Link to="/auth">Create Account</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-background border-t">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2024 Barangay Connect. All rights reserved.</p>
        </div>
      </footer>
    </div>;
};
export default Landing;