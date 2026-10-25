const SettingsAppleIDSection = ({ githubData }) => {
  const profile = githubData?.profile;
  if (!profile) return null;

  return (
    <div className="w-full max-w-2xl mx-auto p-4 @sm:p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col items-center mb-6 text-center px-2 overflow-hidden w-full">
        <img
          src={profile.avatar_url}
          className="w-20 h-20 @sm:w-24 @sm:h-24 rounded-full mb-3 shadow-lg border-2 border-white shrink-0"
          alt="Avatar"
        />
        <h2 className="text-[20px] @sm:text-[24px] font-semibold text-gray-900 tracking-tight">
          {profile.name}
        </h2>
        <p className="text-[12px] @sm:text-[13px] text-gray-500 mt-1">Guest account</p>
      </div>
      <div className="w-full bg-gray-50 rounded-xl border border-gray-200 overflow-hidden shadow-sm p-4">
        <p className="text-[13px] text-gray-600 leading-relaxed">
          You are using Deskhand as a guest. Nothing here is synced to a real account.
        </p>
      </div>
    </div>
  );
};

export default SettingsAppleIDSection;
