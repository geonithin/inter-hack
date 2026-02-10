import { useNavigate } from 'react-router-dom';
import { Mail, Instagram, Linkedin, Send, CheckCircle } from 'lucide-react';
import { useState } from 'react';

export default function Landing() {
    const navigate = useNavigate();
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
        <div className="flex flex-col items-center justify-center text-center space-y-6 sm:space-y-8 animate-in fade-in duration-300">
            <div className="space-y-4 max-w-5xl">
                <div className="space-y-2">
                    <h1 className="text-responsive-h1 text-oxford tracking-tighter uppercase leading-[0.85]">
                        Stella Mary's College of Engineering
                    </h1>
                    <p className="text-sm sm:text-lg text-oxford/70 font-medium">
                        Affiliated To Anna University, Accredited by NAAC and NBA (Mech & CSE)
                    </p>
                    <p className="text-sm sm:text-lg text-oxford/70 font-thin">
                        (AN AUTONOMOUS INSTITUTION)
                    </p>
                    
                </div>
                <p className="text-sm sm:text-2xl lg:text-3xl text-oxford/70 max-w-4xl mx-auto font-bold tracking-tight leading-relaxed">
                    Inter-College Hackathon 2026. <br className="hidden sm:block" />
                    Innovate, Collaborate, and Build the Future using Zero-Cost Technologies.
                </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full max-w-xl px-4">
                <button
                    onClick={() => navigate('/register')}
                    className="flex-[1.5] bg-oxford text-white font-black py-5 px-10 rounded-2xl hover:bg-oxford-dark transition-all duration-200 shadow-lg hover:shadow-xl uppercase tracking-[0.2em] text-[10px] sm:text-base border-2 border-oxford-dark"
                >
                    Register Your Team
                </button>
                <button
                    onClick={() => navigate('/login')}
                    className="flex-1 bg-white text-oxford font-black py-5 px-10 rounded-2xl hover:bg-oxford/5 transition-all duration-200 shadow-lg hover:shadow-xl uppercase tracking-[0.2em] text-[10px] sm:text-base border-2 border-oxford"
                >
                    Dashboard Login
                </button>
            </div>

            <div className="pt-8 sm:pt-12 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 w-full max-w-7xl px-4">
                {[
                    { title: "Select Problems", desc: "Choose from department-wise filterable problem statements with live locking logic." },
                    { title: "Submit Ideas", desc: "Professional platform to submit and track your team's innovative solutions." },
                    { title: "Notifications", desc: "Get instant updates on selection outcomes, deadlines, and dashboard activity." }
                ].map((feature, i) => (
                    <div key={i} className="p-4 sm:p-8 oxford-edge rounded-xl sm:rounded-2xl space-y-2 sm:space-y-3 bg-white text-left">
                        <h3 className="text-lg lg:text-2xl font-black text-oxford uppercase tracking-tight">{feature.title}</h3>
                        <p className="text-[10px] lg:text-base text-oxford/80 font-bold leading-relaxed">{feature.desc}</p>
                    </div>
                ))}
            </div>

            {/* Rules Section */}
            <section id="rules" className="pt-8 sm:pt-16 w-full max-w-7xl px-4 text-left space-y-6 sm:space-y-8">
                <div className="space-y-2 sm:space-y-4">
                    <h2 className="text-2xl lg:text-6xl font-black text-oxford uppercase tracking-tighter">Registration Rules</h2>
                    <div className="w-12 sm:w-24 h-1 sm:h-2 bg-oxford" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-12">
                    <div className="space-y-4 sm:space-y-6">
                        <div className="p-4 sm:p-8 bg-oxford/5 rounded-xl sm:rounded-2xl">
                            <h4 className="font-black text-xl sm:text-3xl uppercase tracking-tight mb-1 sm:mb-2">Team Composition</h4>
                            <p className="text-[10px] sm:text-base text-oxford/80 font-bold">Min 2, Max 5 members per team.</p>
                        </div>
                        <div className="p-4 sm:p-8 bg-oxford/5 rounded-xl sm:rounded-2xl">
                            <h4 className="font-black text-xl sm:text-3xl uppercase tracking-tight mb-1 sm:mb-2">Registration</h4>
                            <p className="text-[10px] sm:text-base text-oxford/80 font-bold">Complete before the locking period.</p>
                        </div>
                    </div>
                    <div className="space-y-4 sm:space-y-6">
                        <div className="p-4 sm:p-8 bg-oxford/5 rounded-xl sm:rounded-2xl">
                            <h4 className="font-black text-xl sm:text-3xl uppercase tracking-tight mb-1 sm:mb-2">One Problem</h4>
                            <p className="text-[10px] sm:text-base text-oxford/80 font-bold">Work on only one problem at a time.</p>
                        </div>
                        <div className="p-4 sm:p-8 bg-oxford/5 rounded-xl sm:rounded-2xl">
                            <h4 className="font-black text-xl sm:text-3xl uppercase tracking-tight mb-1 sm:mb-2">Authenticity</h4>
                            <p className="text-[10px] sm:text-base text-oxford/80 font-bold">Original code only. No plagiarism.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Guidelines Section */}
            <section id="guidelines" className="pt-8 sm:pt-16 pb-6 sm:pb-10 w-full max-w-7xl px-4 text-left space-y-6 sm:space-y-8">
                <div className="space-y-2 sm:space-y-4">
                    <h2 className="text-2xl lg:text-6xl font-black text-oxford uppercase tracking-tighter text-right">Guidelines</h2>
                    <div className="w-12 sm:w-24 h-1 sm:h-2 bg-oxford ml-auto" />
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
            <section id="contact" className="pt-8 sm:pt-16 pb-8 sm:pb-12 w-full max-w-7xl px-4 text-left space-y-6 sm:space-y-8">
                <div className="space-y-2 sm:space-y-4">
                    <h2 className="text-2xl lg:text-6xl font-black text-oxford uppercase tracking-tighter">Contact Us</h2>
                    <div className="w-12 sm:w-24 h-1 sm:h-2 bg-oxford" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12">
                    <div className="space-y-6 sm:space-y-8">
                        <div className="space-y-2">
                            <h3 className="text-xl sm:text-3xl font-black text-oxford uppercase tracking-tight">Get in Touch</h3>
                            <p className="text-sm sm:text-base text-oxford/80 font-bold leading-relaxed">
                                Have questions about the hackathon? Reach out to us and we'll get back to you as soon as possible.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 sm:p-6 bg-oxford/5 rounded-xl sm:rounded-2xl flex items-center gap-4">
                                <div className="p-3 bg-oxford rounded-xl">
                                    <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                                </div>
                                <div>
                                    <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest mb-1 text-oxford/70">Email</h4>
                                    <a href="mailto:hackathon@smce.edu.in" className="text-sm sm:text-lg font-black text-oxford hover:text-oxford-light transition-all">hackathon@smce.edu.in</a>
                                </div>
                            </div>
                            <div className="p-4 sm:p-6 bg-oxford/5 rounded-xl sm:rounded-2xl">
                                <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest mb-2 text-oxford/70">Phone</h4>
                                <a href="tel:+919876543210" className="text-base sm:text-xl font-black text-oxford hover:text-oxford-light transition-all">+91 98765 43210</a>
                            </div>
                            <div className="p-4 sm:p-6 bg-oxford/5 rounded-xl sm:rounded-2xl">
                                <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest mb-2 text-oxford/70">Location</h4>
                                <p className="text-sm sm:text-base font-black text-oxford leading-relaxed">
                                    Stella Mary's College of Engineering<br />
                                    Kanyakumari District, Tamil Nadu<br />
                                    India - 629202
                                </p>
                            </div>
                        </div>

                        {/* Social Media Links */}
                        <div className="pt-4 space-y-4">
                            <h4 className="text-lg sm:text-xl font-black text-oxford uppercase tracking-tight">Connect With Us</h4>
                            <div className="flex items-center gap-4">
                                <a 
                                    href="https://instagram.com/smce_hackathon" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl hover:shadow-2xl transition-all active:scale-95 group"
                                >
                                    <Instagram className="w-6 h-6 sm:w-8 sm:h-8 text-white group-hover:scale-110 transition-transform" />
                                </a>
                                <a 
                                    href="https://linkedin.com/company/smce-hackathon" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-4 bg-[#0077B5] rounded-2xl hover:shadow-2xl transition-all active:scale-95 group"
                                >
                                    <Linkedin className="w-6 h-6 sm:w-8 sm:h-8 text-white group-hover:scale-110 transition-transform" />
                                </a>
                                <a 
                                    href="mailto:hackathon@smce.edu.in"
                                    className="p-4 bg-oxford rounded-2xl hover:shadow-2xl transition-all active:scale-95 group"
                                >
                                    <Mail className="w-6 h-6 sm:w-8 sm:h-8 text-white group-hover:scale-110 transition-transform" />
                                </a>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-oxford via-oxford to-oxford-dark text-white p-8 sm:p-10 rounded-3xl shadow-2xl space-y-6 border border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white/10 rounded-xl">
                                <Send className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">Quick Message</h3>
                        </div>
                        
                        {submitStatus === 'success' && (
                            <div className="bg-green-500/20 border-2 border-green-400 text-green-100 p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top">
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
                <div className="mt-6 bg-gradient-to-br from-oxford to-oxford-light text-white p-6 sm:p-10 rounded-3xl shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                        <div className="space-y-3">
                            <div className="text-4xl sm:text-6xl font-black">48</div>
                            <p className="text-sm sm:text-base font-bold uppercase tracking-widest text-white/70">Hours of Innovation</p>
                        </div>
                        <div className="space-y-3">
                            <div className="text-4xl sm:text-6xl font-black">100+</div>
                            <p className="text-sm sm:text-base font-bold uppercase tracking-widest text-white/70">Participating Teams</p>
                        </div>
                        <div className="space-y-3">
                            <div className="text-4xl sm:text-6xl font-black">₹50K</div>
                            <p className="text-sm sm:text-base font-bold uppercase tracking-widest text-white/70">Prize Pool</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );

}
