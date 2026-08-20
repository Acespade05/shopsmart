export default function ShopSmartBackground() {
  return (
    <div className="shopsmart-bg" aria-hidden="true">
      {/* Soft atmospheric glows */}
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>
      <div className="bg-glow bg-glow-3"></div>

      {/* Moving light trails */}
      <div className="light-trail trail-1"></div>
      <div className="light-trail trail-2"></div>
      <div className="light-trail trail-3"></div>

      {/* Floating particles */}
      <div className="particles">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>

      {/* ShopSmart winged shopping bag */}
      <div className="winged-bag">

        {/* Left wing */}
        <svg
          className="wing wing-left"
          viewBox="0 0 160 120"
          fill="none"
        >
          <path
            d="M145 72
               C120 65 110 48 88 34
               C67 20 42 21 18 32
               C39 38 53 48 62 61
               C42 54 25 58 8 69
               C31 71 46 79 54 91
               C40 88 27 93 18 103
               C46 103 70 98 87 84
               C105 70 122 67 145 72Z"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Shopping bag */}
        <svg
          className="shopping-bag"
          viewBox="0 0 220 250"
          fill="none"
        >
          {/* Handle */}
          <path
            d="M70 65V48
               C70 18 150 18 150 48V65"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
          />

          {/* Bag */}
          <path
            d="M42 65
               H178
               L190 220
               C191 229 184 236 175 236
               H45
               C36 236 29 229 30 220
               L42 65Z"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinejoin="round"
          />

          {/* Handle attachment dots */}
          <circle cx="70" cy="65" r="5" fill="currentColor" />
          <circle cx="150" cy="65" r="5" fill="currentColor" />

          {/* ShopSmart S */}
          <path
            d="M132 105
               C123 96 103 94 94 101
               C85 108 90 119 104 124
               L120 130
               C136 136 137 149 127 156
               C117 163 97 160 88 150"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>

        {/* Right wing */}
        <svg
          className="wing wing-right"
          viewBox="0 0 160 120"
          fill="none"
        >
          <path
            d="M15 72
               C40 65 50 48 72 34
               C93 20 118 21 142 32
               C121 38 107 48 98 61
               C118 54 135 58 152 69
               C129 71 114 79 106 91
               C120 88 133 93 142 103
               C114 103 90 98 73 84
               C55 70 38 67 15 72Z"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

      </div>
    </div>
  );
}