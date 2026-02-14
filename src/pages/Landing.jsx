import { useNavigate } from 'react-router-dom';
import { Mail, Instagram, Linkedin, Send, CheckCircle, Phone, MapPin, Globe } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function Landing() {
    const navigate = useNavigate();
    const { isAuthenticated, getUserRole } = useAuth();
    const [formData, setFormData] = useState({ name: '', email: '', message: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null);

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus(null);

        try {
            // Using Web3Forms API (free service)
            const response = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    access_key: 'c908c812-0894-4964-8eba-b81914ec1448',
                    name: formData.name,
                    email: formData.email,
                    message: formData.message,
                    to: 'geonithinj@gmail.com',
                    subject: 'New Message from SMCE Hackathon Website',
                }),
            });

            const result = await response.json();

            if (result.success) {
                setSubmitStatus('success');
                setFormData({ name: '', email: '', message: '' });
                setTimeout(() => setSubmitStatus(null), 5000);
            } else {
                setSubmitStatus('error');
            }
        } catch (error) {
            console.error('Form submission error:', error);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="relative flex flex-col items-center justify-center text-center space-y-6 sm:space-y-8 animate-in fade-in duration-300">
            {/* Background Logo - Mobile: centered and larger, Desktop: bottom positioned */}
            <div 
                className="block sm:hidden fixed inset-0 bg-no-repeat opacity-10 z-0 pointer-events-none"
                style={{ 
                    backgroundImage: 'url(/clg-logo.png)',
                    backgroundSize: '80%',
                    backgroundPosition: 'center 60%'
                }}
            ></div>
            <div 
                className="hidden sm:block fixed inset-0 bg-no-repeat opacity-10 z-0 pointer-events-none"
                style={{ 
                    backgroundImage: 'url(/clg-logo.png)',
                    backgroundSize: '35%',
                    backgroundPosition: 'center 85%'
                }}
            ></div>
            
            {/* Content */}
            <div className="relative z-10 space-y-4 max-w-6xl">
                <div className="space-y-5">
                    {/* Mobile Layout - Stacked */}
                    <div className="block sm:hidden text-center space-y-1">
                        <div className="relative flex items-center justify-center min-h-8">
                            {/* Left logo - positioned independently */}
                            <div className="absolute left-1/2 -translate-x-[calc(0%+140px)]">
                                <img 
                                    src="/clg-logo.png" 
                                    alt="SMCE Logo" 
                                    className="h-8 w-auto object-contain"
                                />
                            </div>
                            
                            {/* Center - College Name */}
                            <div className="text-lg text-oxford tracking-tighter uppercase leading-none font-black">
                                <div>Stella Mary's College</div>
                                <div>of Engineering</div>
                            </div>
                            
                            {/* Right logos - positioned independently */}
                            <div className="absolute right-1/2 translate-x-[calc(35%+140px)] flex flex-row">
                                <img 
                                    src="/naac-logo.png" 
                                    alt="NAAC Accredited" 
                                    className="h-6 w-auto object-contain"
                                    onError={(e) => {e.target.style.display = 'none'}}
                                />
                                <img 
                                    src="/nba-logo.png" 
                                    alt="NBA Accredited" 
                                    className="h-6 w-auto object-contain -ml-1"
                                    onError={(e) => {e.target.style.display = 'none'}}
                                />
                            </div>
                        </div>
                        <div className="space-y-0">
                            <p className="text-[8px] text-oxford/70 font-medium text-center">
                                Affiliated To Anna University, Accredited by NAAC and NBA (Mech & CSE)
                            </p>
                            <p className="text-[8px] text-oxford/70 font-thin text-center">
                                (AN AUTONOMOUS INSTITUTION)
                            </p>
                        </div>
                    </div>

                    {/* Desktop Layout - Horizontal */}
                    <div className="hidden sm:flex items-center justify-center gap-5 ml-8">
                        {/* Left side - College Logo */}
                        <div className="shrink-0">
                            <img 
                                src="/clg-logo.png" 
                                alt="SMCE Logo" 
                                className="h-12 lg:h-16 w-auto object-contain"
                            />
                        </div>
                        
                        {/* Center - College Name */}
                        <div className="flex-1 text-center">
                            <div className="text-2xl lg:text-3xl xl:text-4xl text-oxford tracking-tighter uppercase leading-[0.85] font-black">
                                <div> Stella Mary's College of Engineering </div>
                                
                            </div>
                        </div>
                        
                        {/* Right side - Accreditation Logos */}
                        <div className="shrink-0 flex flex-row">
                            <img 
                                src="/naac-logo.png" 
                                alt="NAAC Accredited" 
                                className="h-10 lg:h-14 w-auto object-contain"
                                onError={(e) => {e.target.style.display = 'none'}}
                            />
                            <img 
                                src="/nba-logo.png" 
                                alt="NBA Accredited" 
                                className="h-10 lg:h-14 w-auto object-contain -ml-6"
                                onError={(e) => {e.target.style.display = 'none'}}
                            />
                        </div>
                    </div>

                    <p className="hidden sm:block text-lg text-oxford/70 font-medium -mt-7 text-center">
                        Affiliated To Anna University, Accredited by NAAC and NBA (Mech & CSE)
                    </p>
                    <p className="hidden sm:block text-lg text-oxford/70 font-thin -mt-5 text-center">
                        (AN AUTONOMOUS INSTITUTION)
                    </p>
                    
                </div>
                <p className="text-sm sm:text-2xl lg:text-3xl text-oxford max-w-4xl mx-auto font-bold tracking-tight leading-relaxed mt-12 sm:mt-16">
                    INNOTECH CHALLENGE'26 <br className="hidden sm:block" />
                </p>
                <p className="text-sm sm:text-lg lg:text-xl text-oxford/70 max-w-4xl mx-auto font-semibold -mt-5 tracking-tight leading-relaxed">
                    INTRA HACKATHON 2026
                </p>
            </div>

            {/* Go to Dashboard button - only for logged-in users */}
            {isAuthenticated() && (
                <div className="relative z-10 mt-8 sm:mt-12">
                    <button
                        onClick={() => {
                            const role = getUserRole();
                            if (role === 'faculty' || role === 'admin') {
                                navigate('/faculty', { replace: true });
                            } else {
                                navigate('/dashboard', { replace: true });
                            }
                        }}
                        className="bg-oxford text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:bg-opacity-90 hover:-translate-y-0.5 active:translate-y-0 uppercase tracking-wide text-xs sm:text-sm"
                    >
                        Go to Dashboard
                    </button>
                </div>
            )}

            {/* Only show these buttons when user is NOT logged in */}
            {!isAuthenticated() && (
                <div className="relative z-10 flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-md px-4 mt-8 sm:mt-12">
                    <button
                        onClick={() => navigate('/register')}
                        className="flex-1 bg-oxford text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md hover:bg-opacity-90 hover:-translate-y-0.5 active:translate-y-0 uppercase tracking-wide text-xs sm:text-sm"
                    >
                        Register Team
                    </button>
                    <button
                        onClick={() => navigate('/login')}
                        className="flex-1 bg-white text-oxford font-semibold py-3 px-6 rounded-lg border border-oxford/20 transition-all duration-200 shadow-sm hover:shadow-md hover:border-oxford/40 hover:-translate-y-0.5 active:translate-y-0 uppercase tracking-wide text-xs sm:text-sm"
                    >
                        Login
                    </button>
                </div>
            )}

            <div className="relative z-10 pt-8 sm:pt-12 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 w-full max-w-7xl px-4">
                {[
                    { title: "Select Problems", desc: "Select your problem statement early, as each can be chosen by only three teams on a first-come basis." },
                    { title: "Submit Ideas", desc: "Submit your solution including a title, brief overview, tech stack used, and an optional prototype link." },
                    { title: "Notifications", desc: "Get instant updates on selection outcomes, deadlines, and dashboard activity." }
                ].map((feature, i) => (
                    <div key={i} className="p-4 sm:p-8 oxford-edge rounded-xl sm:rounded-2xl space-y-2 sm:space-y-3 bg-white text-left">
                        <h3 className="text-lg lg:text-2xl font-black text-oxford uppercase tracking-tight">{feature.title}</h3>
                        <p className="text-[10px] lg:text-base text-oxford/80 font-bold leading-relaxed">{feature.desc}</p>
                    </div>
                ))}
            </div>

<section id="contact" className="relative z-10 pt-8 sm:pt-16 pb-8 sm:pb-12 w-full max-w-7xl px-4 text-left space-y-6 sm:space-y-8">
    <div className="mt-4 bg-linear-to-br from-oxford to-oxford-light text-white p-4 sm:p-6 rounded-2xl shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
                    <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div className="space-y-1">
                            <div className="text-2xl sm:text-3xl font-black">50</div>
                            <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-white/70">Problem Statements</p>
                        </div>
                        <div className="space-y-1">
                            <div className="text-2xl sm:text-3xl font-black">Certificates</div>
                            <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-white/70">For all participants</p>
                        </div>
                        <div className="space-y-1">
                            <div className="text-2xl sm:text-3xl font-black">Cash Prize</div>
                            <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-white/70">Reward</p>
                        </div>
                    </div>
                </div>
                </section>
            {/* Rules Section */}
            <section id="rules" className="relative z-10 pt-8 sm:pt-16 w-full max-w-5xl px-4 space-y-6 sm:space-y-8">
                <div className="space-y-2 sm:space-y-4 text-center sm:text-left">
                    <h2 className="text-2xl lg:text-4xl font-black text-oxford uppercase tracking-tighter">Registration Rules</h2>
                    <div className="w-20 sm:w-40 h-1 bg-oxford mx-auto sm:mx-0" />
                </div>
                <div className="flex flex-col items-center gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
                    <div className="w-full max-w-xs sm:max-w-none p-3 sm:p-6 bg-white shadow-lg hover:shadow-xl rounded-xl transition-shadow duration-200 text-center">
                        <h4 className="font-black text-sm sm:text-xl uppercase tracking-tight mb-1 sm:mb-2 text-oxford">Team Size</h4>
                        <p className="text-xs sm:text-base text-oxford/80 font-bold leading-snug">max 2 members per team</p>
                    </div>
                    <div className="w-full max-w-xs sm:max-w-none p-3 sm:p-6 bg-white shadow-lg hover:shadow-xl rounded-xl transition-shadow duration-200 text-center">
                        <h4 className="font-black text-sm sm:text-xl uppercase tracking-tight mb-1 sm:mb-2 text-oxford">Registration</h4>
                        <p className="text-xs sm:text-base text-oxford/80 font-bold leading-snug">Complete before the deadline.</p>
                    </div>
                    <div className="w-full max-w-xs sm:max-w-none p-3 sm:p-6 bg-white shadow-lg hover:shadow-xl rounded-xl transition-shadow duration-200 text-center">
                        <h4 className="font-black text-sm sm:text-xl uppercase tracking-tight mb-1 sm:mb-2 text-oxford">One Problem</h4>
                        <p className="text-xs sm:text-base text-oxford/80 font-bold leading-snug">You can work on only one problem at a time.</p>
                    </div>
                    <div className="w-full max-w-xs sm:max-w-none p-3 sm:p-6 bg-white shadow-lg hover:shadow-xl rounded-xl transition-shadow duration-200 text-center">
                        <h4 className="font-black text-sm sm:text-xl uppercase tracking-tight mb-1 sm:mb-2 text-oxford">Authenticity</h4>
                        <p className="text-xs sm:text-base text-oxford/80 font-bold leading-snug">Original code only. No plagiarism.</p>
                    </div>
                </div>
            </section>

            {/* Guidelines Section */}
            <section id="guidelines" className="relative z-10 pt-8 sm:pt-16 pb-6 sm:pb-10 w-full max-w-7xl px-4 text-left space-y-6 sm:space-y-8">
                <div className="space-y-2 sm:space-y-4">
                    <h2 className="text-2xl lg:text-4xl font-black text-oxford uppercase tracking-tighter text-right">Guidelines</h2>
                    <div className="w-12 sm:w-30 h-1 sm:h-1 bg-oxford ml-auto" />
                </div>
                <div className="bg-oxford text-white p-6 sm:p-12 rounded-2xl sm:rounded-3xl shadow-2xl space-y-6 sm:space-y-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 sm:w-64 sm:h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-12">
                        <div className="space-y-1 sm:space-y-4">
                            <div className="text-2xl sm:text-5xl font-black opacity-20">01</div>
                            <h4 className="text-base sm:text-xl font-black uppercase tracking-widest">Initial Selection</h4>
                            <p className="text-white/60 text-[10px] sm:text-base font-medium">Browse problem statements and register your team.</p>
                        </div>
                        <div className="space-y-1 sm:space-y-4">
                            <div className="text-2xl sm:text-5xl font-black opacity-20">02</div>
                            <h4 className="text-base sm:text-xl font-black uppercase tracking-widest">Idea Submission</h4>
                            <p className="text-white/60 text-[10px] sm:text-base font-medium">Draft your solution and technology stack.</p>
                        </div>
                        <div className="space-y-1 sm:space-y-4">
                            <div className="text-2xl sm:text-5xl font-black opacity-20">03</div>
                            <h4 className="text-base sm:text-xl font-black uppercase tracking-widest">Zero-Cost Tech</h4>
                            <p className="text-white/60 text-[10px] sm:text-base font-medium">Use open-source and free technologies.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact Section */}
            <section id="contact" className="relative z-10 pt-8 sm:pt-16 pb-8 sm:pb-12 w-full max-w-7xl px-4 text-left space-y-6 sm:space-y-8">
                <div className="space-y-2 sm:space-y-4">
                    <h2 className="text-2xl lg:text-4xl font-black text-oxford uppercase tracking-tighter">Contact Us</h2>
                    <div className="w-12 sm:w-30 h-1 sm:h-1 bg-oxford" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12">
                    <div className="space-y-6 sm:space-y-8">
                        <div className="space-y-2">
                            <h3 className="text-xl sm:text-2xl font-black text-oxford uppercase tracking-tight">Get in Touch</h3>
                            <p className="text-sm sm:text-base text-oxford/80 font-bold leading-relaxed">
                                Have questions about the hackathon? Reach out to us and we'll get back to you as soon as possible.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 sm:p-6 bg-white shadow-lg hover:shadow-xl rounded-xl sm:rounded-2xl inline-flex items-center gap-4 transition-shadow duration-200">
                                <div className="p-3 bg-oxford rounded-xl">
                                    <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                                </div>
                                <div>
                                    <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest mb-1 text-oxford/70">Email</h4>
                                    <a href="mailto:intrahackathon2026@gmail.com" className="text-sm sm:text-lg font-black text-oxford hover:text-oxford-light transition-all whitespace-nowrap">intrahackathon2026@gmail.com</a>
                                </div>
                            </div>
                            
                            <div className="p-4 sm:p-6 bg-white shadow-lg hover:shadow-xl rounded-xl sm:rounded-2xl inline-flex items-center gap-4 transition-shadow duration-200">
                                <div className="p-3 bg-oxford rounded-xl">
                                    <Phone className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                                </div>
                                <div>
                                    <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest mb-1 text-oxford/70">Phone</h4>
                                    
                                    <a href="tel:+918220480952" className="text-sm sm:text-lg font-black text-oxford hover:text-oxford-light transition-all whitespace-nowrap">+918220480952</a>
                                </div>
                            </div>
                            <div className="p-4 sm:p-6 bg-white shadow-lg hover:shadow-xl rounded-xl sm:rounded-2xl inline-flex items-start gap-4 transition-shadow duration-200">
                                <div className="p-3 bg-oxford rounded-xl">
                                    <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                                </div>
                                <div>
                                    <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest mb-1 text-oxford/70">Location</h4>
                                    <a href="https://www.google.com/maps/place/Stella+Mary's+College+Of+Engineering/@8.1336344,77.3404294,17z/data=!3m1!4b1!4m6!3m5!1s0x3b04fae7b453d579:0xf4356d0b26d3dd2a!8m2!3d8.1336344!4d77.3430043!16s%2Fg%2F11b7qq7hst?entry=ttu&g_ep=EgoyMDI2MDIwOC4wIKXMDSoASAFQAw%3D%3D" className="text-sm sm:text-lg font-black text-oxford hover:text-oxford-light transition-all whitespace-nowrap">Aruthengenvilai, Nagercoil,<br />
                                         Kanyakumari District,<br />
                                        629002</a>
                                
                                </div>
                            </div>
                        </div>

                        {/* Social Media Links */}
                        <div className="pt-4 space-y-3">
                            <h4 className="text-sm sm:text-base font-bold text-oxford uppercase tracking-wide">Connect With Us</h4>
                            <div className="flex items-center gap-2.5">
                                <a 
                                    href="https://instagram.com/smcecoe" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-2.5 bg-linear-to-br from-oxford to-oxford rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 group"
                                >
                                    <Instagram className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                                </a>
                                <a 
                                    href="https://www.linkedin.com/school/stella-mary's-college-of-engineering" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-2.5 bg-oxford rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 group"
                                >
                                    <Linkedin className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                                </a>
                                <a 
                                    href="https://stellamaryscoe.edu.in/"
                                    className="p-2.5 bg-oxford rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 group"
                                >
                                    <Globe className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                                </a>
                            </div>
                        </div>
                    </div>
                    <div className="bg-linear-to-br from-oxford via-oxford to-oxford-dark text-white p-8 sm:p-10 rounded-3xl shadow-2xl space-y-6 border border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white/10 rounded-xl">
                                <Send className="w-6 h-6 text-white" />
                            </div>
                            <p className="text-1xl sm:text-1xl font-black uppercase tracking-tight">Facing any issues with the dashboard? Submit your queries here.</p>
                        </div>
                        
                        
                        {submitStatus === 'success' && (
                            <div className="bg-green-500/20 text-green-100 p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top shadow-lg shadow-green-500/25">
                                <CheckCircle className="w-5 h-5 shrink-0" />
                                <p className="font-bold text-sm">Message sent successfully! We'll get back to you soon.</p>
                            </div>
                        )}
                        
                        {submitStatus === 'error' && (
                            <div className="bg-red-500/20 border-2 border-red-400 text-red-100 p-4 rounded-xl font-bold text-sm animate-in slide-in-from-top">
                                Failed to send message. Please try emailing us directly at geonithinj@gmail.com
                            </div>
                        )}
                        
                        <form className="space-y-5" onSubmit={handleSubmit}>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest mb-2.5 text-white/70">Name</label>
                                <input 
                                    type="text" 
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required 
                                    disabled={isSubmitting}
                                    className="w-full px-5 py-3.5 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder:text-white/40 font-semibold focus:bg-white/15 focus:border-white/50 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                                    placeholder="Your Name" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest mb-2.5 text-white/70">Email</label>
                                <input 
                                    type="email" 
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    required 
                                    disabled={isSubmitting}
                                    className="w-full px-5 py-3.5 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder:text-white/40 font-semibold focus:bg-white/15 focus:border-white/50 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                                    placeholder="your.email@example.com" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest mb-2.5 text-white/70">Message</label>
                                <textarea 
                                    name="message"
                                    value={formData.message}
                                    onChange={handleInputChange}
                                    required 
                                    rows="4" 
                                    disabled={isSubmitting}
                                    className="w-full px-5 py-3.5 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder:text-white/40 font-semibold focus:bg-white/15 focus:border-white/50 focus:outline-none transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed" 
                                    placeholder="Your message here..."
                                ></textarea>
                            </div>
                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="w-full bg-white text-oxford font-black py-4 px-6 rounded-xl hover:bg-gray-100 transition-all duration-200 shadow-xl uppercase tracking-[0.2em] text-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-5 h-5 border-3 border-oxford border-t-transparent rounded-full animate-spin"></div>
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Send Message
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Additional Info Card to Fill Space */}
                
            </section>
        </div>
    );

}
