import { useNavigate } from 'react-router-dom';

export default function Landing() {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] sm:min-h-[60vh] text-center space-y-8 sm:space-y-10 lg:space-y-12 animate-in fade-in duration-700">
            <div className="space-y-6 max-w-5xl">
                <h1 className="text-responsive-h1 text-oxford tracking-tighter uppercase leading-[0.85] mb-4">
                    Stella Mary's <br />
                    <span className="text-oxford/10 font-black">College of Engineering</span>
                </h1>
                <p className="text-sm sm:text-2xl lg:text-3xl text-oxford/30 max-w-4xl mx-auto font-bold tracking-tight leading-relaxed">
                    Inter-College Hackathon 2026. <br className="hidden sm:block" />
                    Innovate, Collaborate, and Build the Future using Zero-Cost Technologies.
                </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full max-w-xl px-4">
                <button
                    onClick={() => navigate('/register')}
                    className="flex-[1.5] bg-oxford text-white font-black py-4 px-10 rounded-xl sm:rounded-2xl hover:bg-oxford-dark transition-all shadow-2xl uppercase tracking-[0.2em] text-[10px] sm:text-base active:scale-95"
                >
                    Register Your Team
                </button>
                <button
                    onClick={() => navigate('/login')}
                    className="flex-1 bg-white text-oxford border-2 sm:border-4 border-oxford font-black py-4 px-10 rounded-xl sm:rounded-2xl hover:bg-gray-50 transition-all shadow-xl uppercase tracking-[0.2em] text-[10px] sm:text-base active:scale-95"
                >
                    Dashboard Login
                </button>
            </div>

            <div className="pt-12 sm:pt-20 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 w-full max-w-7xl px-4">
                {[
                    { title: "Select Problems", desc: "Choose from department-wise filterable problem statements with live locking logic." },
                    { title: "Submit Ideas", desc: "Professional platform to submit and track your team's innovative solutions." },
                    { title: "Notifications", desc: "Get instant updates on selection outcomes, deadlines, and dashboard activity." }
                ].map((feature, i) => (
                    <div key={i} className="p-4 sm:p-8 oxford-edge rounded-xl sm:rounded-2xl space-y-2 sm:space-y-3 bg-white text-left">
                        <h3 className="text-lg lg:text-2xl font-black text-oxford uppercase tracking-tight">{feature.title}</h3>
                        <p className="text-[10px] lg:text-base text-oxford/60 font-bold leading-relaxed">{feature.desc}</p>
                    </div>
                ))}
            </div>

            {/* Rules Section */}
            <section id="rules" className="pt-16 sm:pt-32 w-full max-w-7xl px-4 text-left space-y-8 sm:space-y-12">
                <div className="space-y-2 sm:space-y-4">
                    <h2 className="text-2xl lg:text-6xl font-black text-oxford uppercase tracking-tighter">Registration Rules</h2>
                    <div className="w-12 sm:w-24 h-1 sm:h-2 bg-oxford" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-12">
                    <div className="space-y-4 sm:space-y-6">
                        <div className="p-4 sm:p-8 bg-oxford/5 rounded-xl sm:rounded-2xl">
                            <h4 className="font-black text-xl sm:text-3xl uppercase tracking-tight mb-1 sm:mb-2">Team Composition</h4>
                            <p className="text-[10px] sm:text-base text-oxford/60 font-bold">Min 2, Max 5 members per team.</p>
                        </div>
                        <div className="p-4 sm:p-8 bg-oxford/5 rounded-xl sm:rounded-2xl">
                            <h4 className="font-black text-xl sm:text-3xl uppercase tracking-tight mb-1 sm:mb-2">Registration</h4>
                            <p className="text-[10px] sm:text-base text-oxford/60 font-bold">Complete before the locking period.</p>
                        </div>
                    </div>
                    <div className="space-y-4 sm:space-y-6">
                        <div className="p-4 sm:p-8 bg-oxford/5 rounded-xl sm:rounded-2xl">
                            <h4 className="font-black text-xl sm:text-3xl uppercase tracking-tight mb-1 sm:mb-2">One Problem</h4>
                            <p className="text-[10px] sm:text-base text-oxford/60 font-bold">Work on only one problem at a time.</p>
                        </div>
                        <div className="p-4 sm:p-8 bg-oxford/5 rounded-xl sm:rounded-2xl">
                            <h4 className="font-black text-xl sm:text-3xl uppercase tracking-tight mb-1 sm:mb-2">Authenticity</h4>
                            <p className="text-[10px] sm:text-base text-oxford/60 font-bold">Original code only. No plagiarism.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Guidelines Section */}
            <section id="guidelines" className="pt-16 sm:pt-32 pb-10 sm:pb-20 w-full max-w-7xl px-4 text-left space-y-8 sm:space-y-12">
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
        </div>
    );

}
