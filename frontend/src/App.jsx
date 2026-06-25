import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
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

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
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
      <div className="grain min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tools" element={<ToolsDirectory />} />
            <Route path="/category/:slug" element={<CategoryPage />} />
            <Route path="/tool/:slug" element={<ToolDetail />} />
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
