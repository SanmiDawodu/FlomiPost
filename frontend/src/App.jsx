import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ComposePage = lazy(() => import('./pages/ComposePage'))
const QueuePage = lazy(() => import('./pages/QueuePage'))
const PostsPage = lazy(() => import('./pages/PostsPage'))
const SitesPage = lazy(() => import('./pages/SitesPage'))
const ConnectionsPage = lazy(() => import('./pages/ConnectionsPage'))
const MediaPage = lazy(() => import('./pages/MediaPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const InboxPage = lazy(() => import('./pages/InboxPage'))
const CampaignsPage = lazy(() => import('./pages/CampaignsPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const WhatsAppContactsPage = lazy(() => import('./pages/WhatsAppContactsPage'))
const BroadcastPage = lazy(() => import('./pages/BroadcastPage'))
const SocialListeningPage = lazy(() => import('./pages/SocialListeningPage'))
const GAAnalyticsPage = lazy(() => import('./pages/GAAnalyticsPage'))
const EmailPage = lazy(() => import('./pages/EmailPage'))
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'))
const LeadOutreachPage = lazy(() => import('./pages/LeadOutreachPage'))
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage'))
const WebhooksPage = lazy(() => import('./pages/WebhooksPage'))
const SetsPage = lazy(() => import('./pages/SetsPage'))
const AutoPostPage = lazy(() => import('./pages/AutoPostPage'))
const TeamPage = lazy(() => import('./pages/TeamPage'))
const SignaturesPage = lazy(() => import('./pages/SignaturesPage'))
const RecyclePage = lazy(() => import('./pages/RecyclePage'))
const BulkImportPage = lazy(() => import('./pages/BulkImportPage'))
const RSSFeedsPage = lazy(() => import('./pages/RSSFeedsPage'))
const LabelsPage = lazy(() => import('./pages/LabelsPage'))
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage'))
const AISchedulePage = lazy(() => import('./pages/AISchedulePage'))
const CommentTemplatePage = lazy(() => import('./pages/CommentTemplatePage'))
const VoiceLearningPage = lazy(() => import('./pages/VoiceLearningPage'))
const BlogToSocialPage = lazy(() => import('./pages/BlogToSocialPage'))
const CarouselPage = lazy(() => import('./pages/CarouselPage'))
const LeadMagnetOptinPage = lazy(() => import('./pages/LeadMagnetOptinPage'))
const TodoPage = lazy(() => import('./pages/TodoPage'))
const ChannelHealthPage = lazy(() => import('./pages/ChannelHealthPage'))

const qc = new QueryClient({defaultOptions:{queries:{retry:1,staleTime:30000}}})

function PrivateRoute({children}) {
  const {user,loading} = useAuthStore()
  if(loading) return <PageLoader/>
  return user ? children : <Navigate to="/login" replace/>
}

function PageLoader() {
  return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--bg)'}}><div className="fp-spinner"/></div>
}

export default function App() {
  const init = useAuthStore(s=>s.init)
  useEffect(()=>{init()},[])
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader/>}>
          <Routes>
            <Route path="/login" element={<LoginPage/>}/>
            <Route path="/" element={<PrivateRoute><Layout/></PrivateRoute>}>
              <Route index element={<DashboardPage/>}/>
              <Route path="calendar" element={<CalendarPage/>}/>
              <Route path="compose" element={<ComposePage/>}/>
              <Route path="compose/:id" element={<ComposePage/>}/>
              <Route path="queue" element={<QueuePage/>}/>
              <Route path="analytics" element={<AnalyticsPage/>}/>
              <Route path="inbox" element={<InboxPage/>}/>
              <Route path="campaigns" element={<CampaignsPage/>}/>
              <Route path="reports" element={<ReportsPage/>}/>
              <Route path="whatsapp-contacts" element={<WhatsAppContactsPage/>}/>
              <Route path="broadcast" element={<BroadcastPage/>}/>
              <Route path="comment-templates" element={<CommentTemplatePage/>}/>
              <Route path="lead-magnet-optin" element={<LeadMagnetOptinPage/>}/>
              <Route path="voice-learning" element={<VoiceLearningPage/>}/>
              <Route path="blog-to-social" element={<BlogToSocialPage/>}/>
              <Route path="carousel" element={<CarouselPage/>}/>
              <Route path="lead-outreach" element={<LeadOutreachPage/>}/>
              <Route path="tasks" element={<TodoPage/>}/>
              <Route path="integrations" element={<IntegrationsPage/>}/>
              <Route path="listening" element={<SocialListeningPage/>}/>
              <Route path="ga-analytics" element={<GAAnalyticsPage/>}/>
              <Route path="email" element={<EmailPage/>}/>
              <Route path="templates" element={<TemplatesPage/>}/>
              <Route path="posts" element={<PostsPage/>}/>
              <Route path="sites" element={<SitesPage/>}/>
              <Route path="connections" element={<ConnectionsPage/>}/>
              <Route path="media" element={<MediaPage/>}/>
              <Route path="users" element={<UsersPage/>}/>
              <Route path="settings" element={<SettingsPage/>}/>
              <Route path="webhooks" element={<WebhooksPage/>}/>
              <Route path="sets" element={<SetsPage/>}/>
              <Route path="auto-post" element={<AutoPostPage/>}/>
              <Route path="team" element={<TeamPage/>}/>
              <Route path="signatures" element={<SignaturesPage/>}/>
              <Route path="recycle" element={<RecyclePage/>}/>
              <Route path="bulk-import" element={<BulkImportPage/>}/>
              <Route path="rss-feeds" element={<RSSFeedsPage/>}/>
              <Route path="labels" element={<LabelsPage/>}/>
              <Route path="approvals" element={<ApprovalsPage/>}/>
              <Route path="ai-schedule" element={<AISchedulePage/>}/>
              <Route path="channel-health" element={<ChannelHealthPage/>}/>
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="bottom-right" toastOptions={{style:{background:'#1a0f4e',color:'#f0eeff',border:'1px solid rgba(91,60,245,0.3)',fontFamily:'Plus Jakarta Sans,sans-serif',fontSize:'13px',borderRadius:'10px'},success:{iconTheme:{primary:'#10b981',secondary:'#1a0f4e'}},error:{iconTheme:{primary:'#ff5c6a',secondary:'#1a0f4e'}}}}/>
    </QueryClientProvider>
  )
}
