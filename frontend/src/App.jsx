import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { useEffect } from "react";
import { Navbar, Footer } from "./components/chrome.jsx";
import { ScrollProgress, BackToTop } from "./components/scrollui.jsx";
import { CommandPalette } from "./components/palette.jsx";
import { RouteSweep } from "./components/pageturn.jsx";
import { NotFoundBlock } from "./components/editorial.jsx";
import Home from "./pages/Home.jsx";
import ToolsDirectory from "./pages/ToolsDirectory.jsx";
import CategoryPage from "./pages/CategoryPage.jsx";
import ToolDetail from "./pages/ToolDetail.jsx";
import Compare from "./pages/Compare.jsx";
import Blog from "./pages/Blog.jsx";
import BlogPost from "./pages/BlogPost.jsx";
import About from "./pages/About.jsx";
import Contact from "./pages/Contact.jsx";
import Privacy from "./pages/Privacy.jsx";
import Disclosure from "./pages/Disclosure.jsx";
import Terms from "./pages/Terms.jsx";
import Submit from "./pages/Submit.jsx";
import Stacks from "./pages/Stacks.jsx";
import Admin from "./pages/Admin.jsx";
import BestIndex from "./pages/BestIndex.jsx";
import BestList from "./pages/BestList.jsx";
import HowWeReview from "./pages/HowWeReview.jsx";

// Carries a legacy /tool/:slug or /category/:slug straight to its plural
// equivalent, replacing the history entry so Back doesn't bounce.
function LegacyRedirect({ to }) {
  const { slug } = useParams();
  return <Navigate to={`${to}/${slug}`} replace />;
}

function ScrollTop() {
  const { pathname } = useLocation();
  // block body on purpose: scrollTo returns a Promise in current Chrome, and a
  // concise arrow would hand that back to React as the effect's cleanup
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Editorial 404 — a "missing page" that still reads like the rest of the broadsheet.
function NotFound() {
  return (
    <NotFoundBlock
      title="That page didn't make this issue."
      message="It may have moved, been renamed, or never run at all."
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollTop />
      <ScrollProgress />
      <BackToTop />
      <CommandPalette />
      <RouteSweep />
      <div className="grain min-h-dvh flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tools" element={<ToolsDirectory />} />
            <Route path="/tools/:slug" element={<ToolDetail />} />
            <Route path="/categories/:slug" element={<CategoryPage />} />

            {/* The old singular paths. Anything already shared or indexed keeps
                working and lands on the canonical URL, so no link that exists in
                the wild breaks and nothing ends up indexed at two addresses. */}
            <Route path="/tool/:slug" element={<LegacyRedirect to="/tools" />} />
            <Route path="/category/:slug" element={<LegacyRedirect to="/categories" />} />

            <Route path="/best" element={<BestIndex />} />
            <Route path="/best/:slug" element={<BestList />} />
            <Route path="/how-we-review" element={<HowWeReview />} />

            {/* The tool page already *is* the review — full write-up, features,
                pros, the catch, rating and reader reviews. A separate /reviews
                URL for the same tool would be two pages competing for one query,
                so this exists to keep the link shape working, not to duplicate. */}
            <Route path="/reviews/:slug" element={<LegacyRedirect to="/tools" />} />
            <Route path="/reviews" element={<Navigate to="/tools" replace />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/disclosure" element={<Disclosure />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/submit" element={<Submit />} />
            <Route path="/stacks" element={<Stacks />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
